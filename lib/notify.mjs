import { fetchJson, sleep, truncate } from './util.mjs';

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
  constructor({ store, ask }) {
    this.store = store;
    this.ask = ask;
    this.generation = 0;
    this.polling = false;
    this.timer = null;
    this.lastError = '';
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
    this.polling = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  refresh() {
    this.generation += 1;
    const generation = this.generation;
    this.polling = false;
    const settings = this.store.settings();
    if (!settings.notify?.telegram?.enabled) return;
    if (!settings.notify.telegram.token || !settings.notify.telegram.chatId) return;
    this.pollTelegram(generation).catch(() => {});
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

  async handleOwnerText(text, channel = 'telegram') {
    const settings = this.store.settings();
    const clean = String(text || '').trim();
    if (!clean) return '';
    const command = clean.toLowerCase();

    if (command === '/ayuda' || command === 'ayuda') {
      return 'Puedo responder /estado, /misiones, /resumen, /pausar y /activar. También podés escribirme una pregunta y la paso al equipo.';
    }
    if (command === '/pausar') {
      await this.store.saveSettings({ notify: { paused: true } });
      return 'Listo. Pauso los avisos hasta que escribas /activar.';
    }
    if (command === '/activar') {
      await this.store.saveSettings({ notify: { paused: false } });
      return 'Avisos activados de nuevo.';
    }
    if (command === '/estado' || command === 'estado') {
      return this.statusText();
    }
    if (command === '/misiones' || command === 'misiones') {
      return this.missionsText();
    }
    if (command === '/resumen' || command === 'resumen') {
      return this.latestSummary();
    }

    if (clean.length > 1800) return 'La pregunta es muy larga. Resumila en menos de 1800 caracteres.';
    if (!this.ask) return 'Todavía no puedo responder preguntas. Configurá una IA en Lumbre.';
    try {
      const answer = await this.ask(clean, channel);
      return truncate(answer, 3800);
    } catch (error) {
      return `No pude consultar al equipo: ${truncate(error.message, 300)}. Revisá la configuración de IA en Lumbre.`;
    }
  }

  statusText() {
    const settings = this.store.settings();
    const missions = this.store.get('missions');
    const threads = this.store.get('threads');
    const active = missions.filter((m) => ['running', 'queued'].includes(m.status));
    const hot = threads.filter((t) => ['interesado', 'negociando'].includes(t.stage));
    const drafts = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'listo').length, 0);
    const lines = [
      `${settings.brand?.name || 'Lumbre'} — estado de hoy`,
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
    if (!missions.length) return 'Todavía no hay misiones. Creá una desde Lumbre con un producto y un objetivo.';
    return missions.map((m) => {
      const status = { running: 'en curso', queued: 'en cola', done: 'terminada', done_with_warnings: 'terminada con avisos', error: 'con error', cancelled: 'cancelada' }[m.status] || m.status;
      return `· ${m.name} — ${status}${m.demo ? ' (demo)' : ''}${m.status === 'running' ? ` ${m.progress || 0}%` : ''}`;
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

    const lines = [`${settings.brand?.name || 'Lumbre'} — resumen del día`, ''];
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
      lines.push('', `Prioridad: ${top.contact?.company || 'un contacto'} (${top.contact?.country || ''}) — ${top.nextStep || 'revisar la conversación'}.`);
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

    while (this.generation === generation) {
      try {
        const offset = Number(this.store.get('meta').telegramOffset || 0);
        const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=25&allowed_updates=${encodeURIComponent('["message"]')}${offset ? `&offset=${offset}` : ''}`;
        const { ok, data } = await fetchJson(url, { timeoutMs: 35000 });
        if (this.generation !== generation) break;
        if (!ok || !data?.ok) {
          this.lastError = data?.description || 'Telegram rechazó la conexión';
          if (/unauthorized|not found/i.test(this.lastError)) break;
          await sleep(15000);
          continue;
        }
        for (const update of data.result || []) {
          const nextOffset = Number(update.update_id) + 1;
          await this.store.setMeta({ telegramOffset: nextOffset });
          const message = update.message;
          if (!message?.text) continue;
          if (String(message.chat?.id) !== String(chatId)) continue;
          const reply = await this.handleOwnerText(message.text, 'telegram');
          if (reply) await sendTelegram(this.store.settings(), reply).catch(() => {});
        }
      } catch (error) {
        if (this.generation !== generation) break;
        this.lastError = error.message;
        await sleep(15000);
      }
    }
    this.polling = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   Transportes
   ───────────────────────────────────────────────────────────── */

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

export async function telegramChats(token) {
  if (!token) throw new Error('Falta el token de Telegram');
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
    await sendTelegram(settings, `Lumbre conectado. Este es un mensaje de prueba para ${settings.brand?.name || 'tu marca'}.`);
    sent = true;
  }
  return { bot: me.data.result?.username || '', name: me.data.result?.first_name || '', sent };
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
