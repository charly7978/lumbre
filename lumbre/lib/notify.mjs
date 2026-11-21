import { fetchJson, sleep, truncate } from './util.mjs';
import { productReadiness } from './readiness.mjs';

/* ─────────────────────────────────────────────────────────────
   Avisos al dueño. La regla es simple: interrumpir solo cuando
   hay algo que decidir. El resto va al resumen diario.
   ───────────────────────────────────────────────────────────── */

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

export class Notifier {
  constructor({ store, ask, actions = {} }) {
    this.store = store;
    this.ask = ask;
    this.actions = actions || {};
    this.generation = 0;
    this.polling = false;
    this.timer = null;
    this.lastError = '';
    this.lastPollAt = null;
    this.lastInboundAt = null;
    this.lastReplyAt = null;
    this.started = false;
  }

  start() {
    this.started = true;
    this.refresh();
    if (!this.timer) {
      this.timer = setInterval(() => this.maybeDigest().catch(() => {}), 10 * 60 * 1000);
      this.timer.unref?.();
    }
    setTimeout(() => this.maybeDigest().catch(() => {}), 45 * 1000).unref?.();
  }

  stop() {
    this.generation += 1;
    this.started = false;
    // No liberamos polling hasta que el request en curso terminó.
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // Arranca el loop de Telegram con la generación y la configuración vigentes.
  //Si ya hay un loop activo, no hace nada: ese loop se detendrá solo al
  //detectar el cambio de generación y volverá a llamar a este método.
  startPolling() {
    if (!this.started || this.polling) return;
    const settings = this.store.settings();
    if (!settings.notify?.telegram?.enabled) return;
    if (!settings.notify.telegram.token || !settings.notify.telegram.chatId) return;
    this.pollTelegram(this.generation).catch((error) => {
      this.lastError = this._redact(error?.message || String(error));
      this.polling = false;
      this.store.activity('system', `Telegram: ${this.lastError}`).catch(() => {});
    });
  }

  refresh() {
    this.generation += 1;
    this.startPolling();
  }

  channels(settings = this.store.settings()) {
    return {
      telegram: Boolean(settings.notify?.telegram?.enabled && settings.notify?.telegram?.token && settings.notify?.telegram?.chatId),
      whatsapp: Boolean(settings.notify?.whatsapp?.enabled && settings.notify?.whatsapp?.token && settings.notify?.whatsapp?.phoneNumberId && settings.notify?.whatsapp?.to),
    };
  }

  async notify(text, { kind = 'info', force = false } = {}) {
    const settings = this.store.settings();
    if (settings.notify?.paused && !force) return { sent: false, reason: 'pausado' };
    const eventMap = {
      mission_done: 'missionDone',
      mission_error: 'missionError',
      mission_warning: 'missionWarning',
      hot_reply: 'hotReply',
      opt_out: 'optOut',
      digest: 'digest',
      info: null,
    };
    const eventKey = eventMap[kind];
    if (eventKey && settings.notify?.events?.[eventKey] === false && !force) {
      return { sent: false, reason: 'evento desactivado' };
    }

    const channels = this.channels(settings);
    const results = [];
    if (channels.telegram) {
      try {
        await sendTelegram(settings, text);
        results.push({ channel: 'telegram', ok: true });
      } catch (error) {
        results.push({ channel: 'telegram', ok: false, error: error.message });
        this.lastError = error.message;
        await this.store.activity('system', `No se pudo enviar el aviso por Telegram: ${error.message}`).catch(() => {});
      }
    }
    if (channels.whatsapp) {
      try {
        await sendWhatsApp(settings, text);
        results.push({ channel: 'whatsapp', ok: true });
      } catch (error) {
        results.push({ channel: 'whatsapp', ok: false, error: error.message });
        this.lastError = error.message;
        await this.store.activity('system', `No se pudo enviar el aviso por WhatsApp: ${error.message}`).catch(() => {});
      }
    }
    return { sent: results.some((r) => r.ok), results };
  }

  async handleOwnerText(text, channel = 'telegram', chatId = null, attachments = []) {
    const settings = this.store.settings();
    const ownerChatId = String(settings.notify?.telegram?.chatId || chatId || '');
    const effectiveChatId = String(chatId || ownerChatId);
    if (ownerChatId && effectiveChatId && String(effectiveChatId) !== String(ownerChatId)) {
      return '';
    }
    const clean = String(text || '').trim();
    const files = Array.isArray(attachments) ? attachments : [];

    // Transcripción de audios e imágenes adjuntas: el agente "ve" y "oye"
    // antes de responder, igual que un asistente humano.
    const images = [];
    const transcripts = [];
    for (const file of files) {
      if (file?.type === 'image' && file.dataUrl) {
        images.push({ dataUrl: file.dataUrl, mime: file.mime });
      } else if (file?.type === 'audio' && file.buffer) {
        try {
          const { resolveAIConfig, transcribeAudio } = await import('./ai.mjs');
          const cfg = resolveAIConfig(this.store.settings());
          const transcript = await transcribeAudio(cfg, file.buffer, file.mime || 'audio/ogg');
          if (transcript) transcripts.push(transcript);
        } catch (error) {
          transcripts.push(`[No pude transcribir el audio: ${truncate(error.message, 120)}]`);
        }
      }
    }

    const composite = [clean, ...transcripts.map((t) => `Audio transcrito: "${t}"`)]
      .filter(Boolean)
      .join('\n\n')
      .trim();
    const question = composite || (images.length ? 'El usuario envió una imagen. Describila y respondé.' : '');

    if (!question && !images.length) return '';

    // sesion de memoria
    const sessions = this.store.get('telegramSessions') || {};
    if (!sessions[effectiveChatId]) sessions[effectiveChatId] = { history: [], pending: null, updatedAt: new Date().toISOString() };
    const session = sessions[effectiveChatId];
    session.history = Array.isArray(session.history) ? session.history : [];

    const lower = clean.toLowerCase();

    // comandos
    if (lower === '/start' || lower === 'start') {
      const msg = 'Hola. Soy tu agente por Telegram. Puedo responder estado, misiones, resumen, preparar borradores, buscar, lanzar misiones y mas. Probá: "¿cómo venimos?", "prepará una respuesta para Avanluce", "mandá el mail", "lanzá una misión para España". /ayuda para ver todo.';
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (lower === '/ayuda' || lower === 'ayuda') {
      const msg = 'Comandos: /estado, /prioridades, /oportunidades, /diagnostico, /misiones, /resumen, /pausar, /activar, /reiniciar. También podés escribirme una pregunta o pedirme una acción: "buscá tiendas en Madrid", "prepará borrador para X", "mandá el mail", "lanzá la misión", "subí el precio".';
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (lower === '/pausar') {
      await this.store.saveSettings({ notify: { paused: true } });
      const msg = 'Listo. Pauso los avisos hasta que escribas /activar.';
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (lower === '/activar') {
      await this.store.saveSettings({ notify: { paused: false } });
      const msg = 'Avisos activados de nuevo.';
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (lower === '/estado' || lower === 'estado') {
      const msg = this.statusText();
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (['/diagnostico', 'diagnostico', '/telegram'].includes(lower)) {
      const health = this.telegramDiagnostics();
      const msg = [
        'Telegram, diagnóstico de entrada y salida:',
        `Configurado: ${health.configured ? 'sí' : 'no'}`,
        `Escuchando: ${health.polling ? 'sí' : 'no'}`,
        `Última consulta: ${health.lastPollAt || 'sin datos'}`,
        `Último mensaje recibido: ${health.lastInboundAt || 'sin datos'}`,
        `Última respuesta enviada: ${health.lastReplyAt || 'sin datos'}`,
        health.lastError ? `Error: ${health.lastError}` : 'Último error: ninguno',
        'Este comando prueba la recepción. Para probar la IA escribí una pregunta libre.',
      ].join('\n');
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (['/prioridades', 'prioridades', '/comercial'].includes(lower)) {
      const msg = this.commercialPrioritiesText();
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (['/oportunidades', 'oportunidades'].includes(lower)) {
      const msg = this.opportunitiesText();
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (lower === '/misiones' || lower === 'misiones') {
      const msg = this.missionsText();
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (lower === '/resumen' || lower === 'resumen') {
      const msg = this.latestSummary();
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (lower === '/reiniciar' || lower === 'reiniciar') {
      session.history = [];
      session.pending = null;
      session.updatedAt = new Date().toISOString();
      await this._persistSessions(sessions);
      return 'Historial reiniciado.';
    }

    // confirmacion / cancelacion de accion pendiente
    if (session.pending) {
      if (/^(confirmar|sí|si|dale|ok|yes)$/i.test(lower)) {
        const pending = session.pending;
        session.pending = null;
        const res = await this._executePending(pending, settings);
        const msg = res.message || (res.ok ? 'Listo.' : 'Falló.');
        this._appendHistory(session, 'user', clean);
        this._appendHistory(session, 'assistant', msg);
        await this._persistSessions(sessions);
        return msg;
      }
      if (/^(cancelar|no|cancel)$/i.test(lower)) {
        session.pending = null;
        const msg = 'Cancelado.';
        this._appendHistory(session, 'user', clean);
        this._appendHistory(session, 'assistant', msg);
        await this._persistSessions(sessions);
        return msg;
      }
      // nuevo pedido: reemplaza pendiente
      session.pending = null;
    }

    if (question.length > 1800) {
      const msg = 'La pregunta es muy larga. Resumila en menos de 1800 caracteres.';
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }
    if (!this.ask) {
      const msg = 'Todavía no puedo responder preguntas. Configurá una IA en Lucian.';
      this._appendHistory(session, 'user', clean);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }

    this._appendHistory(session, 'user', question);

    // typing indicator via sendChatAction (best effort)
    try {
      const token = settings.notify?.telegram?.token;
      if (token && effectiveChatId) {
        await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: effectiveChatId, action: 'typing' }),
        }).catch(() => {});
      }
    } catch { /* noop */ }

    let answer = '';
    try {
      answer = await this.ask(question, channel, session.history.slice(0, -1), images);
    } catch (error) {
      answer = `No pude consultar al equipo: ${truncate(error.message, 300)}. Revisá la configuración de IA en Lucian.`;
    }

    // parse action
    const { parseAction } = await import('./telegram-actions.mjs');
    const { action, cleanText } = parseAction(answer);
    const visible = cleanText || answer.replace(/```json[\s\S]*?```/g, '').trim() || answer;

    if (action) {
      if (action.requiere_accion) {
        const { describeAction } = await import('./telegram-actions.mjs');
        const spec = (await import('./telegram-actions.mjs')).ACTION_SPECS[action.tipo];
        // Marcar una venta ganada o una pérdida afecta métricas y postventa:
        // requiere confirmación expresa del dueño, nunca solo decisión de la IA.
        const finalStage = action.tipo === 'actualizar_hilo'
          && ['ganado', 'perdido'].includes(String(action.args?.stage || '').toLowerCase());
        const isAuto = spec?.auto === true && !finalStage;
        if (isAuto) {
          const { executeAction } = await import('./telegram-actions.mjs');
          const res = await executeAction({ action, store: this.store, actions: this.actions, chatId: effectiveChatId, search: async (s, q, o) => {
            const { searchWebDetailed } = await import('./search.mjs');
            return searchWebDetailed(s, q, o);
          } });
          const msg = res.ok ? `Listo: ${res.message}` : `No pude: ${res.message}`;
          this._appendHistory(session, 'assistant', msg);
          await this._persistSessions(sessions);
          return msg;
        }
        // confirmable
        session.pending = action;
        const msg = `${visible}\n\nSi lo confirmás, escribí "confirmar"; para cancelar, "cancelar".`;
        this._appendHistory(session, 'assistant', msg);
        await this._persistSessions(sessions);
        return msg;
      }
    }

    // error fallback: if answer only error, include estado
    if (/no pude consultar/i.test(answer)) {
      const extra = `\n\n${this.statusText()}`;
      const msg = truncate(visible + extra, 3800);
      this._appendHistory(session, 'assistant', msg);
      await this._persistSessions(sessions);
      return msg;
    }

    this._appendHistory(session, 'assistant', visible);
    await this._persistSessions(sessions);
    return visible;
  }

  _appendHistory(session, role, text) {
    const redacted = this._redact(String(text || '').slice(0, 2000));
    session.history = session.history || [];
    session.history.push({ role, text: redacted, at: new Date().toISOString() });
    if (session.history.length > 12) session.history = session.history.slice(-12);
    session.updatedAt = new Date().toISOString();
  }

  _redact(text) {
    return text.replace(/gsk_[A-Za-z0-9_-]+/g, '[redacted]').replace(/tvly-[A-Za-z0-9_-]+/g, '[redacted]').replace(/bot\d+:[A-Za-z0-9_-]+/g, '[redacted]');
  }

  async _persistSessions(sessions) {
    try {
      await this.store.setDebounced('telegramSessions', sessions, 300);
    } catch { /* noop */ }
  }

  async _executePending(action, settings) {
    const { executeAction } = await import('./telegram-actions.mjs');
    const res = await executeAction({ action, store: this.store, actions: this.actions, chatId: null, search: async (s, q, o) => {
      const { searchWebDetailed } = await import('./search.mjs');
      return searchWebDetailed(s, q, o);
    } });
    return res;
  }

  telegramDiagnostics() {
    const t = this.store.settings().notify?.telegram || {};
    return {
      configured: Boolean(t.enabled && t.token && t.chatId),
      polling: this.started && this.polling,
      lastPollAt: this.lastPollAt,
      lastInboundAt: this.lastInboundAt,
      lastReplyAt: this.lastReplyAt,
      lastError: this.lastError,
    };
  }

  commercialPrioritiesText() {
    const products = (this.store.get('products') || []).filter((p) => p.status !== 'archivado' && !p.demo);
    const threads = (this.store.get('threads') || []).filter((t) => !t.demo);
    const missing = products.map((p) => ({ name: p.name || p.sku || 'Producto', result: productReadiness(p) }))
      .filter((p) => !p.result.readyForProspecting);
    const hot = threads.filter((t) => ['interesado', 'negociando', 'respondio'].includes(t.stage));
    const review = threads.reduce((n, t) => n + (t.drafts || []).filter((d) => d.status === 'revisar').length, 0);
    const ready = threads.reduce((n, t) => n + (t.drafts || []).filter((d) => d.status === 'listo').length, 0);
    const overdue = threads.filter((t) => t.nextFollowUp && new Date(t.nextFollowUp).getTime() <= Date.now()
      && !['ganado', 'perdido'].includes(t.stage));
    const email = this.store.settings().email || {};
    const mailReady = email.provider !== 'manual' && (
      (email.provider === 'resend' && Boolean(email.resendKey && email.from))
      || (email.provider === 'gmail' && Boolean(email.smtpUser && email.smtpPassword))
      || (email.provider === 'webhook' && Boolean(email.webhookUrl)));
    const lines = [
      'Prioridades comerciales REALES (sin datos demo):',
      `Productos activos: ${products.length}; incompletos: ${missing.length}`,
      `Conversaciones con respuesta o interés: ${hot.length}`,
      `Borradores para revisar: ${review}; listos: ${ready}`,
      `Seguimientos vencidos: ${overdue.length}`,
      `Envío por correo: ${mailReady ? 'configurado; requiere verificación real' : 'pendiente de configurar'}`,
    ];
    if (missing.length) lines.push(`1. Completar ${missing[0].name}: ${missing[0].result.missing[0]?.label || 'revisar ficha'}.`);
    if (hot.length) lines.push(`2. Responder a ${hot[0].contact?.company || hot[0].contact?.name || 'contacto interesado'}.`);
    if (overdue.length) lines.push(`3. Revisar seguimiento de ${overdue[0].contact?.company || overdue[0].contact?.name || 'contacto'}.`);
    if (review) lines.push('4. Revisar los borradores antes de enviarlos.');
    if (!mailReady) lines.push('5. Conectar y probar el correo de salida para convertir borradores en contactos reales.');
    if (!products.length) lines.push('Cargá al menos una lámpara real con foto y precio; sin catálogo no hay campaña verificable.');
    if (!hot.length && !ready && !review && products.length && !missing.length) {
      lines.push('Siguiente acción: ejecutar una misión comercial sobre un producto y revisar los prospectos verificables.');
    }
    return lines.join('\n');
  }

  opportunitiesText() {
    const threads = (this.store.get('threads') || []).filter((t) =>
      !t.demo && ['respondio', 'interesado', 'negociando'].includes(t.stage))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    if (!threads.length) return 'No hay conversaciones reales con respuesta o interés registradas. Esto NO significa que se hayan concretado ventas.';
    return [
      `Oportunidades comerciales reales: ${threads.length}`,
      ...threads.slice(0, 8).map((t, i) =>
        `${i + 1}. ${t.contact?.company || t.contact?.name || 'Contacto'} [${t.stage}]. Próximo paso: ${truncate(t.nextStep || 'responder y calificar interés', 110)}`),
    ].join('\n');
  }

  statusText() {
    const settings = this.store.settings();
    const missions = this.store.get('missions');
    const threads = this.store.get('threads');
    const active = missions.filter((m) => ['running', 'queued'].includes(m.status));
    const hot = threads.filter((t) => ['interesado', 'negociando'].includes(t.stage));
    const drafts = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'listo').length, 0);
    const lines = [
      `${settings.brand?.name || 'Lucian'} ”” estado de hoy`,
      `Misiones activas: ${active.length}`,
      `Leads calientes: ${hot.length}`,
      `Borradores listos: ${drafts}`,
    ];
    if (active.length) {
      const m = active[0];
      lines.push(`En curso: ${m.name} (${m.progress || 0}%).`);
    }
    if (settings.notify?.paused) lines.push('Los avisos están pausados. Escribí /activar para retomarlos.');
    return lines.join('\n');
  }

  missionsText() {
    const missions = this.store.get('missions').slice(0, 6);
    if (!missions.length) return 'Todavía no hay misiones. Creá una desde Lucian con un producto y un objetivo.';
    return missions.map((m) => {
      const status = { running: 'en curso', queued: 'en cola', done: 'terminada', done_with_warnings: 'terminada con avisos', error: 'con error', cancelled: 'cancelada' }[m.status] || m.status;
      return `· ${m.name} ”” ${status}${m.demo ? ' (demo)' : ''}${m.status === 'running' ? ` ${m.progress || 0}%` : ''}`;
    }).join('\n');
  }

  latestSummary() {
    const done = this.store.get('missions').find((m) => ['done', 'done_with_warnings'].includes(m.status) && m.summary);
    if (!done) return 'Todavía no hay una misión terminada con resumen.';
    return `${done.name}${done.status === 'done_with_warnings' ? ' (con avisos)' : ''}\n\n${truncate(done.summary, 1800)}`;
  }

  digestText() {
    const settings = this.store.settings();
    const missions = this.store.get('missions');
    const threads = this.store.get('threads');
    const since = Date.now() - 86400000;
    const active = missions.filter((m) => ['running', 'queued'].includes(m.status));
    const finished = missions.filter((m) => ['done', 'done_with_warnings'].includes(m.status) && new Date(m.finishedAt || m.updatedAt).getTime() > since);
    const replies = threads.reduce((acc, t) => acc + (t.messages || []).filter((m) => m.direction === 'in' && new Date(m.at).getTime() > since).length, 0);
    const hot = threads.filter((t) => ['interesado', 'negociando'].includes(t.stage));
    const drafts = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'listo').length, 0);
    const review = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'revisar').length, 0);
    const blocked = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'bloqueado').length, 0);
    const followUps = threads.filter((t) => t.nextFollowUp && new Date(t.nextFollowUp).getTime() < Date.now() && !['ganado', 'perdido'].includes(t.stage));

    const lines = [`${settings.brand?.name || 'Lucian'} ”” resumen del día`, ''];
    lines.push(`Misiones activas: ${active.length}`);
    lines.push(`Terminadas en 24 h: ${finished.length}`);
    lines.push(`Respuestas nuevas: ${replies}`);
    lines.push(`Leads calientes: ${hot.length}`);
    lines.push(`Borradores listos: ${drafts}`);
    if (review) lines.push(`Para revisar antes de enviar: ${review}`);
    if (blocked) lines.push(`Bloqueados por cumplimiento: ${blocked}`);
    if (followUps.length) lines.push(`Seguimientos vencidos: ${followUps.length}`);

    if (hot.length) {
      const top = hot[0];
      lines.push('', `Prioridad: ${top.contact?.company || 'un contacto'} (${top.contact?.country || ''}) ”” ${top.nextStep || 'revisar la conversación'}.`);
    } else if (active.length) {
      lines.push('', `En curso: ${active[0].name} (${active[0].progress || 0}%).`);
    } else if (drafts || review) {
      lines.push('', drafts
        ? 'Hay borradores esperando tu revisión en la bandeja.'
        : `Hay ${review} borrador${review === 1 ? '' : 'es'} por aprobar en la bandeja.`);
    } else {
      lines.push('', 'Día tranquilo. Si querés mover algo, lanzá una misión o revisá la bandeja.');
    }
    return lines.join('\n');
  }

  async maybeDigest() {
    const settings = this.store.settings();
    if (!settings.notify?.events?.digest) return;
    if (settings.notify?.paused) return;
    const hour = Number(settings.notify?.telegram?.digestHour ?? 9);
    const now = new Date();
    if (now.getHours() < hour) return;
    const meta = this.store.get('meta');
    if (meta.lastDigest === todayKey()) return;
    const channels = this.channels(settings);
    if (!channels.telegram && !channels.whatsapp) return;
    const result = await this.notify(this.digestText(), { kind: 'digest' });
    if (result.sent) await this.store.setMeta({ lastDigest: todayKey() });
  }

  async pollTelegram(generation) {
    if (this.polling) return;
    this.polling = true;
    const settings = this.store.settings();
    const token = settings.notify?.telegram?.token;
    const chatId = String(settings.notify?.telegram?.chatId || '');
    if (!token || !chatId) { this.polling = false; return; }

    try {
      while (this.started && this.generation === generation) {
        try {
          const offset = Number(this.store.get('meta').telegramOffset || 0);
          const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=25&allowed_updates=${encodeURIComponent('["message"]')}${offset ? `&offset=${offset}` : ''}`;
          const { ok, data } = await fetchJson(url, { timeoutMs: 35000 });
          if (this.generation !== generation || !this.started) break;
          this.lastPollAt = new Date().toISOString();
          if (!ok || !data?.ok) {
            const detail = String(data?.description || 'Telegram rechazó la conexión');
            this.lastError = /conflict/i.test(detail)
              ? 'Conflicto: otro proceso lee este bot o hay un webhook activo. Debe existir un solo receptor de mensajes.'
              : this._redact(detail);
            if (/unauthorized|not found/i.test(detail)) break;
            await sleep(15000);
            continue;
          }
          this.lastError = '';
          for (const update of data.result || []) {
            if (this.generation !== generation || !this.started) break;
            const nextOffset = Number(update.update_id) + 1;
            const message = update.message;
            if (String(message?.chat?.id) !== chatId) {
              // No se responde a chats que no son del dueño.
              await this.store.setMeta({ telegramOffset: nextOffset, telegramPendingReply: null });
              continue;
            }

            // Checkpoint persistente: si falla sendMessage, no volvemos a
            // ejecutar una orden comercial al reintentar la entrega.
            const pending = this.store.get('meta').telegramPendingReply;
            const hasPending = pending && Number(pending.updateId) === Number(update.update_id)
              && String(pending.chatId) === chatId;
            let reply;
            if (hasPending) {
              reply = String(pending.reply || '');
            } else {
              this.lastInboundAt = new Date().toISOString();
              if (!message?.text && !message?.voice && !message?.audio && !message?.caption
                && !(Array.isArray(message?.photo) && message.photo.length)) {
                reply = 'Puedo trabajar con texto, audio e imágenes; enviame el pedido y lo resuelvo.';
              } else {
                const attachments = [];
                if (message.voice?.file_id || message.audio?.file_id) {
                  const fileId = message.voice?.file_id || message.audio?.file_id;
                  const mime = message.voice?.mime_type || message.audio?.mime_type || 'audio/ogg';
                  try {
                    const file = await telegramGetFile(token, fileId);
                    if (file?.file_path) {
                      const buffer = await fetchTelegramFile(token, file.file_path);
                      if (buffer) attachments.push({ type: 'audio', buffer, mime });
                    }
                  } catch (error) { this.lastError = this._redact(error?.message || String(error)); }
                }
                if (Array.isArray(message.photo) && message.photo.length) {
                  const photo = message.photo[message.photo.length - 1];
                  try {
                    const file = await telegramGetFile(token, photo.file_id);
                    if (file?.file_path) {
                      const buffer = await fetchTelegramFile(token, file.file_path);
                      if (buffer) attachments.push({
                        type: 'image', dataUrl: `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`, mime: 'image/jpeg',
                      });
                    }
                  } catch (error) { this.lastError = this._redact(error?.message || String(error)); }
                }
                const text = message.text || message.caption || '';
                reply = await this.handleOwnerText(text, 'telegram', message.chat.id, attachments);
              }
              await this.store.setMeta({
                telegramPendingReply: { updateId: update.update_id, chatId, reply: String(reply || '') },
              });
            }

            if (reply) {
              // No silenciar el error de transporte: una respuesta fallida
              // permanece pendiente y se reintenta sin repetir la acción.
              await sendTelegramText(this.store.settings(), reply, { chatId: message.chat.id });
              this.lastReplyAt = new Date().toISOString();
            }
            await this.store.setMeta({ telegramOffset: nextOffset, telegramPendingReply: null });
          }
        } catch (error) {
          if (this.generation !== generation || !this.started) break;
          this.lastError = this._redact(error?.message || String(error));
          await this.store.activity('system', `Telegram no pudo procesar o entregar un mensaje: ${this.lastError}`).catch(() => {});
          await sleep(15000);
        }
      }
    } finally {
      this.polling = false;
      // El polling anterior termina antes de comenzar con nuevas credenciales.
      this.startPolling();
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   Transportes
   ───────────────────────────────────────────────────────────── */

async function telegramGetFile(token, fileId) {
  if (!token || !fileId) return null;
  const url = `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const { ok, data } = await fetchJson(url, { timeoutMs: 15000 });
  if (!ok || !data?.ok) return null;
  return data.result || null;
}

async function fetchTelegramFile(token, filePath) {
  if (!token || !filePath) return null;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function sendTelegram(settings, text) {
  const token = settings.notify?.telegram?.token;
  const chatId = settings.notify?.telegram?.chatId;
  if (!token || !chatId) throw new Error('Falta token o chat ID de Telegram');
  const { ok, data, text: raw } = await fetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    body: { chat_id: chatId, text: truncate(text, 4000), disable_web_page_preview: true },
    timeoutMs: 20000,
  });
  if (!ok || !data?.ok) throw new Error(`Telegram: ${data?.description || raw.slice(0, 200)}`);
  return data.result;
}

export async function sendTelegramText(settings, text, { chatId } = {}) {
  const token = settings.notify?.telegram?.token;
  const target = chatId || settings.notify?.telegram?.chatId;
  if (!token || !target) throw new Error('Falta token o chat ID de Telegram');
  const chunks = [];
  const raw = String(text || '');
  if (raw.length <= 3500) chunks.push(raw);
  else {
    let buf = '';
    for (const para of raw.split(/\n\n+/)) {
      if ((buf + '\n\n' + para).length > 3500 && buf) { chunks.push(buf); buf = para; }
      else buf = buf ? buf + '\n\n' + para : para;
    }
    if (buf) chunks.push(buf);
    if (!chunks.length) chunks.push(raw.slice(0, 3500));
  }
  for (let i = 0; i < chunks.length; i++) {
    const { ok, data, text: rawText } = await fetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      body: { chat_id: target, text: truncate(chunks[i], 4000), disable_web_page_preview: true },
      timeoutMs: 20000,
    });
    if (!ok || !data?.ok) throw new Error(`Telegram: ${data?.description || rawText.slice(0, 200)}`);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 1100));
  }
  return true;
}

export async function sendWhatsApp(settings, text) {
  const cfg = settings.notify?.whatsapp || {};
  if (!cfg.token || !cfg.phoneNumberId || !cfg.to) throw new Error('Falta token, phone number ID o número de WhatsApp');
  const version = cfg.apiVersion || 'v23.0';
  const { ok, data, text: raw } = await fetchJson(`https://graph.facebook.com/${version}/${cfg.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.token}` },
    body: {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: digits(cfg.to),
      type: 'text',
      text: { preview_url: false, body: truncate(text, 3800) },
    },
    timeoutMs: 25000,
  });
  if (!ok) throw new Error(`WhatsApp: ${data?.error?.message || raw.slice(0, 250)}`);
  return data;
}

export async function telegramChats(token, knownChatId = '') {
  if (!token) throw new Error('Falta el token de Telegram');
  // Si ya conocemos el chat, consultar getChat evita competir con el polling.
  if (knownChatId) {
    const { ok, data, text } = await fetchJson(`https://api.telegram.org/bot${token}/getChat`, {
      method: 'POST', body: { chat_id: knownChatId }, timeoutMs: 15000,
    });
    if (!ok || !data?.ok) throw new Error(`Telegram: ${data?.description || text.slice(0, 200)}`);
    const chat = data.result || {};
    return [{
      id: String(chat.id), name: [chat.first_name, chat.last_name].filter(Boolean).join(' ')
        || chat.title || chat.username || 'Chat', username: chat.username || '',
    }];
  }
  const { ok, data, text } = await fetchJson(`https://api.telegram.org/bot${token}/getUpdates?timeout=1&allowed_updates=${encodeURIComponent('["message"]')}`, { timeoutMs: 15000 });
  if (!ok || !data?.ok) throw new Error(`Telegram: ${data?.description || text.slice(0, 200)}`);
  const chats = [];
  for (const update of data.result || []) {
    const chat = update.message?.chat;
    if (!chat) continue;
    chats.push({
      id: String(chat.id),
      name: [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || chat.username || 'Chat',
      username: chat.username || '',
    });
  }
  return [...new Map(chats.map((c) => [c.id, c])).values()];
}

export async function testTelegram(settings) {
  const token = settings.notify?.telegram?.token;
  if (!token) throw new Error('Falta el token del bot de Telegram');
  const me = await fetchJson(`https://api.telegram.org/bot${token}/getMe`, { timeoutMs: 15000 });
  if (!me.ok || !me.data?.ok) throw new Error(`Telegram: ${me.data?.description || 'token inválido'}`);
  const chatId = settings.notify?.telegram?.chatId;
  let sent = false;
  if (chatId) {
    await sendTelegram(settings, `Lucian conectado. Este es un mensaje de prueba para ${settings.brand?.name || 'tu marca'}.`);
    sent = true;
  }
  const hook = await fetchJson(`https://api.telegram.org/bot${token}/getWebhookInfo`, { timeoutMs: 15000 });
  const webhook = hook.ok && hook.data?.ok ? hook.data.result?.url || '' : '';
  return {
    bot: me.data.result?.username || '', name: me.data.result?.first_name || '',
    sent, inboundVerified: false, webhookActive: Boolean(webhook),
    warning: webhook ? 'Hay un webhook activo: el polling local no recibirá mensajes.' : '',
  };
}

export async function testWhatsApp(settings) {
  const cfg = settings.notify?.whatsapp || {};
  if (!cfg.token || !cfg.phoneNumberId) throw new Error('Faltan token y phone number ID de WhatsApp');
  const version = cfg.apiVersion || 'v23.0';
  const { ok, data, text } = await fetchJson(`https://graph.facebook.com/${version}/${cfg.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, {
    headers: { authorization: `Bearer ${cfg.token}` },
    timeoutMs: 20000,
  });
  if (!ok) throw new Error(`WhatsApp: ${data?.error?.message || text.slice(0, 250)}`);
  return data;
}

export function parseWhatsAppWebhook(payload) {
  const messages = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        if (message.type !== 'text') continue;
        messages.push({
          from: String(message.from || ''),
          text: message.text?.body || '',
          name: value.contacts?.[0]?.profile?.name || '',
          at: new Date(Number(message.timestamp || 0) * 1000).toISOString(),
        });
      }
    }
  }
  return messages;
}
