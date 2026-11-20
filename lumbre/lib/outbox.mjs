import { isDemoEmail, isSuppressed, isValidEmail, normalizeEmail } from './email.mjs';
import { nowISO, uid } from './util.mjs';

/* ─────────────────────────────────────────────────────────────
   Piloto automático de salida.

   Qué hace y qué no:
   - Solo envía borradores que YA pasaron las guardas de la misión
     (cumplimiento, red team, corrección) y quedaron en estado "listo".
   - Solo usa Resend o webhook. Nunca el canal manual: marcar como
     enviado sin enviar sería mentirse a sí mismo.
   - Respeta la lista de no contactar, el límite diario y el
     calentamiento. Si el cupo se agota, reprograma para el día siguiente.
   - No inventa destinatarios: exige un email válido y no de ejemplo.

   Los seguimientos salen de la secuencia que escribió la misión, pero
   con texto neutro y sin precios: un precio viejo en un seguimiento es
   peor que no enviarlo.
   ───────────────────────────────────────────────────────────── */

const TICK_MS = 60 * 1000;
const FOLLOWUP_SCAN_MS = 55 * 60 * 1000;
const MAX_FOLLOWUPS = 2;
const MAX_PER_TICK = 1;
const RETRY_MS = 30 * 60 * 1000;

/* Etapas en las que un envío automático ya no corresponde. Si el contacto
   respondió, está interesado, negocia o compró, la conversación la lleva una
   persona; si quedó perdido, no se vuelve a molestar. */
const BLOCKED_STAGES = new Set(['respondio', 'interesado', 'negociando', 'ganado', 'perdido']);

/* La guarda de etapa existe para que un correo frío no pise una conversación
   viva o cerrada. La postventa es distinto: solo corresponde a quien compró
   (etapa ganado) y se detiene si el cliente vuelve a escribir (otra etapa). */
function stageBlocksOutreach(thread, kind = 'mision') {
  const stage = String(thread?.stage || '');
  if (kind === 'postventa') return stage !== 'ganado';
  return BLOCKED_STAGES.has(stage);
}

function spacingMs(settings) {
  const minutes = Number(settings?.email?.autopilotSpacingMin);
  return Math.max(1, Math.min(120, Number.isFinite(minutes) ? minutes : 5)) * 60 * 1000;
}

function nextMorningIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function lastOutbound(thread) {
  return (thread?.messages || []).filter((message) => message.direction === 'out').slice(-1)[0] || null;
}

function threadLanguage(thread, mission) {
  const draft = (thread?.drafts || []).find((item) => item.language);
  if (draft?.language) return draft.language;
  const sequence = mission?.artifacts?.outreach?.secuencia || [];
  const first = sequence.find((item) => item?.idioma);
  if (first?.idioma) return first.idioma;
  const country = String(thread?.contact?.country || '').toLowerCase();
  return /espa|m[eé]xico|argentin|chile|colombia|uruguay|per[uú]|bolivia|ecuador|venezuela|costa rica|panam|guatemala|salvador|honduras|nicaragua|cuba|dominican/.test(country) ? 'es' : 'en';
}

/* Seguimiento determinista y seguro. El paso 2 aporta algo útil; el 3
   cierra el hilo sin presión. Nunca incluye precios ni plazos. */
export function buildFollowUp(thread, product, mission) {
  const language = threadLanguage(thread, mission);
  const name = String(product?.name || 'la pieza').trim();
  const step = Number(thread.followUpCount || 0) === 0 ? 2 : 3;
  const previous = lastOutbound(thread);
  const baseSubject = previous?.subject || (thread.drafts || []).find((draft) => draft.subject)?.subject || name;
  const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

  const bodies = language === 'en'
    ? {
      2: `Hi again.\n\nI wanted to make sure you saw the note about ${name}. If it helps, I can send the spec sheet with sizes, materials and finish options ”” no commitment.\n\nWould that be useful?`,
      3: `Hi.\n\nI'll close the loop for now. If ${name} or a small series of pieces becomes interesting later, just reply to this email and I'll send the details.\n\nThanks for your time.`,
    }
    : {
      2: `Hola de nuevo.\n\nTe escribo por si te quedó dando vueltas ${name}. Si te sirve, te paso la ficha con medidas, materiales y opciones de terminación, sin compromiso.\n\n¿Te la envío?`,
      3: `Hola.\n\nCierro el hilo por ahora. Si más adelante te interesa ${name} o una serie corta de piezas, respondé este correo y te paso los detalles.\n\nGracias por tu tiempo.`,
    };

  return {
    step,
    language,
    subject,
    body: bodies[step],
    status: 'listo',
  };
}

/* ─────────────────────────────────────────────────────────────
   Postventa: fidelización y recompra.

   Cuando una conversación pasa a "ganado", Lucian agenda tres
   toques deterministas, sin precios ni presión:
   - Paso 1 (día 3): agradecimiento + cuidados de la pieza.
   - Paso 2 (día 30): feedback honesto + pide reseña o remisión.
   - Paso 3 (día 90): novedades, reorden o nueva serie.

   Misma regla que todo lo demás: sin piloto automático quedan
   "Por aprobar". Nunca se escriben a contactos suprimidos ni
   a quien esté en una etapa que no sea ganado.
   ───────────────────────────────────────────────────────────── */
const MAX_POST_SALE = 3;
const POST_SALE_DAYS = [3, 30, 90];

export function buildPostSale(thread, product, brand) {
  const language = threadLanguage(thread, null);
  const name = String(product?.name || 'la pieza').trim();
  const signature = brand?.name ? `\n\nUn abrazo,\n${brand.maker ? `${brand.maker} · ` : ''}${brand.name}` : '\n\nUn abrazo,';
  const signatureEn = brand?.name ? `\n\nBest,\n${brand.maker ? `${brand.maker} · ` : ''}${brand.name}` : '\n\nBest,';
  const step = Number(thread.postSaleCount || 0) + 1;
  const previous = lastOutbound(thread);
  const baseSubject = previous?.subject || (thread.drafts || []).find((draft) => draft.subject)?.subject || name;
  const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;

  const bodies = language === 'en'
    ? {
      1: `Hi.\n\nThank you for trusting us with ${name}. To keep it at its best: wipe with a dry cloth, avoid long direct sun exposure and check the cable periodically if it is electric.\n\nIf anything comes up during setup or care, just reply to this email and I'll help.${signatureEn}`,
      2: `Hi.\n\nNow that ${name} has had some time with you, I'd love to know how it's been working out: is the piece doing its job? Did anyone ask about it?\n\nIf it lived up to it, a review or a mention to other studios and shops is the best help you can give us. If you need a second unit or restock, just say so.${signatureEn}`,
      3: `Hi.\n\nA few months have passed since ${name} arrived. If you'd like another piece from the series or want a look at the new prototypes, reply and I'll send the updated sheet.\n\nAnd if you'd rather not hear from us again, say so and that's it.${signatureEn}`,
    }
    : {
      1: `Hola.\n\nGracias por confiar en ${name}. Para que la pieza siempre rinda al máximo: limpiar con paño seco, evitar sol directo prolongado y revisar el cable si es eléctrica.\n\nSi surge cualquier duda de armado o cuidados, respondé este correo y te ayudo.${signature}`,
      2: `Hola.\n\nAhora que ${name} ya tuvo tiempo de uso, me interesa saber cómo te fue: ¿la pieza está cumpliendo? ¿Alguien te preguntó por ella?\n\nSi te gustó, una reseña o mencionarla a otros estudios y tiendas es la mejor ayuda que nos podés dar. Si necesitás otra unidad o reposición, decilo en este correo.${signature}`,
      3: `Hola.\n\nPasaron unos meses desde que te entregué ${name}. Si te interesa otra pieza de la serie o ver los prototipos nuevos, respondé y te mando la ficha actualizada.\n\nY si preferís no recibir más novedades de la marca, decilo y listo.${signature}`,
    };

  return {
    step,
    language,
    subject,
    body: bodies[step],
    status: 'listo',
  };
}

function eligiblePostSaleThread(thread, settings) {
  if (!thread || thread.demo) return false;
  if (String(thread.stage || '') !== 'ganado') return false;
  if (!isValidEmail(thread.contact?.email) || isDemoEmail(thread.contact?.email)) return false;
  // Los hilos marcados ganado antes de que existiera el ancla usan la
  // última actividad como referencia honesta del día de la compra.
  const anchor = Date.parse(thread.postSaleAt || thread.updatedAt || thread.createdAt || '');
  if (!Number.isFinite(anchor)) return false;
  const count = Number(thread.postSaleCount || 0);
  if (count >= MAX_POST_SALE) return false;
  const pending = (thread.drafts || []).some((draft) => draft.source === 'postventa' && ['listo', 'revisar'].includes(draft.status));
  if (pending) return false;
  const days = POST_SALE_DAYS[count];
  if (!days) return false;
  if (anchor + days * 86400000 > Date.now()) return false;
  if (isSuppressed(thread.contact?.email, settings.__suppressions || [], thread.contact?.company)) return false;
  return true;
}

function eligibleFollowUpThread(thread, settings) {
  if (!thread || thread.demo) return false;
  if (!isValidEmail(thread.contact?.email) || isDemoEmail(thread.contact?.email)) return false;
  const stage = String(thread.stage || '');
  if (['respondio', 'interesado', 'negociando', 'ganado', 'perdido'].includes(stage)) return false;
  if (!lastOutbound(thread)) return false;
  const pending = (thread.drafts || []).some((draft) => ['listo', 'revisar'].includes(draft.status) && draft.source !== 'seguimiento');
  if (pending) return false;
  const followUps = (thread.drafts || []).filter((draft) => draft.source === 'seguimiento');
  if (followUps.length >= MAX_FOLLOWUPS) return false;
  if (followUps.some((draft) => ['listo', 'revisar'].includes(draft.status))) return false;
  if (Number(thread.followUpCount || 0) >= MAX_FOLLOWUPS) return false;
  if (!thread.nextFollowUp) return false;
  const due = Date.parse(thread.nextFollowUp);
  if (!Number.isFinite(due) || due > Date.now()) return false;
  if (isSuppressed(thread.contact?.email, settings.__suppressions || [], thread.contact?.company)) return false;
  return true;
}

export class Outbox {
  constructor({ store, deliver, notify } = {}) {
    this.store = store;
    this.deliver = deliver;
    this.notify = notify;
    this.timer = null;
    this.processing = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.tick().catch(() => {}); }, TICK_MS);
    this.timer.unref?.();
    setTimeout(() => { this.tick().catch(() => {}); }, 20 * 1000).unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  items() {
    return this.store.get('outbox') || [];
  }

  async save() {
    await this.store.set('outbox', this.items());
  }

  status() {
    const items = this.items();
    const pending = items.filter((item) => item.status === 'pending');
    const next = pending
      .map((item) => Date.parse(item.runAt || 0))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)[0] || 0;
    return {
      enabled: Boolean(this.store.settings()?.email?.autopilot),
      pending: pending.length,
      sent: items.filter((item) => item.status === 'sent').length,
      errors: items.filter((item) => item.status === 'error').length,
      nextAt: next ? new Date(next).toISOString() : null,
    };
  }

  canAutopilot(settings = this.store.settings()) {
    return Boolean(settings?.email?.autopilot) && ['resend', 'webhook'].includes(settings?.email?.provider);
  }

  pendingFor(threadId, draftId = null) {
    return this.items().some((item) => item.status === 'pending'
      && item.threadId === threadId
      && (!draftId || item.draftId === draftId));
  }

  async enqueueDraft(thread, draft, { kind = 'mision', step = null, runAt = null } = {}) {
    if (!thread || !draft) return null;
    if (draft.status !== 'listo' || draft.channel !== 'email') return null;
    if (stageBlocksOutreach(thread, kind)) return null;
    if (!isValidEmail(thread.contact?.email) || isDemoEmail(thread.contact?.email)) return null;
    if (this.pendingFor(thread.id, draft.id)) return null;
    const item = {
      id: uid('out'),
      kind,
      step,
      threadId: thread.id,
      draftId: draft.id,
      company: thread.contact?.company || '',
      email: normalizeEmail(thread.contact?.email),
      status: 'pending',
      attempts: 0,
      runAt: runAt || nowISO(),
      createdAt: nowISO(),
    };
    this.items().unshift(item);
    return item;
  }

  /* Al terminar una misión, encola sus borradores listos con un ritmo
     humano. No manda nada acá: solo agenda. */
  async scheduleMission(mission) {
    const settings = this.store.settings();
    if (!mission || mission.demo || !this.canAutopilot(settings)) return { queued: 0 };
    const threads = this.store.get('threads').filter((thread) => thread.missionId === mission.id && !thread.demo);
    const spacing = spacingMs(settings);
    let queued = 0;
    for (const thread of threads) {
      for (const draft of thread.drafts || []) {
        if (draft.status !== 'listo' || draft.channel !== 'email') continue;
        const item = await this.enqueueDraft(thread, draft, {
          kind: 'mision',
          runAt: new Date(Date.now() + queued * spacing).toISOString(),
        });
        if (item) queued += 1;
      }
    }
    if (queued) {
      await this.save();
      await this.store.activity('outreach', `Piloto automático: ${queued} mensaje${queued === 1 ? '' : 's'} en cola para ${mission.name}.`, { missionId: mission.id });
    }
    return { queued };
  }

  /* Encola todo lo que ya está listo y tiene email. Sirve para los
     borradores que existían antes de activar el piloto. */
  async enqueueAllReady() {
    const settings = this.store.settings();
    if (!this.canAutopilot(settings)) return { queued: 0, reason: 'El piloto automático está apagado o el envío es manual.' };
    const spacing = spacingMs(settings);
    let queued = 0;
    for (const thread of this.store.get('threads') || []) {
      if (thread.demo) continue;
      if (isSuppressed(thread.contact?.email, (this.store.get('suppressions') || []).filter((item) => !item.demo), thread.contact?.company)) continue;
      for (const draft of thread.drafts || []) {
        if (draft.status !== 'listo' || draft.channel !== 'email') continue;
        const item = await this.enqueueDraft(thread, draft, {
          kind: draft.source === 'postventa' ? 'postventa' : 'mision',
          runAt: new Date(Date.now() + queued * spacing).toISOString(),
        });
        if (item) queued += 1;
      }
    }
    if (queued) await this.save();
    return { queued };
  }

  async cancel(id) {
    const item = this.items().find((entry) => entry.id === id);
    if (!item || item.status !== 'pending') return false;
    item.status = 'cancelled';
    item.cancelledAt = nowISO();
    await this.save();
    return true;
  }

  async tick() {
    if (this.processing) return;
    this.processing = true;
    try {
      const settings = this.store.settings();
      // Sin piloto automático no se envía nada, pero los seguimientos
      // y la postventa vencidos se preparan para revisión: el dueño solo aprueba.
      if (this.canAutopilot(settings)) await this.processQueue(settings);
      if (settings.email?.followUps !== false) await this.maybeFollowUps(settings);
      if (settings.email?.postSales !== false) await this.maybePostSale(settings);
    } finally {
      this.processing = false;
    }
  }

  async processQueue(settings) {
    // Un solo envío por tick no alcanza para cuidar la reputación: si varias
    // misiones terminan juntas, la cola puede tener decenas de elementos
    // vencidos al mismo tiempo. Esta guarda impone el espaciado global aunque
    // Lucian se haya reiniciado o el equipo haya estado suspendido.
    const spacing = spacingMs(settings);
    const meta = this.store.get('meta') || {};
    const lastSent = Date.parse(meta.lastOutboxSendAt || 0) || 0;
    if (lastSent && Date.now() - lastSent < spacing) return 0;

    const due = this.items()
      .filter((item) => item.status === 'pending' && Date.parse(item.runAt || 0) <= Date.now())
      .sort((a, b) => Date.parse(a.runAt || 0) - Date.parse(b.runAt || 0))
      .slice(0, MAX_PER_TICK);

    for (const item of due) {
      const threads = this.store.get('threads');
      const thread = threads.find((entry) => entry.id === item.threadId);
      if (!thread) {
        item.status = 'cancelled';
        item.error = 'La conversación ya no existe.';
        await this.save();
        continue;
      }
      if (stageBlocksOutreach(thread, item.kind)) {
        item.status = 'cancelled';
        item.error = item.kind === 'postventa'
          ? 'El cliente ya no está en etapa de postventa (volvió a escribir): lo toma una persona.'
          : 'La conversación ya está en una etapa que no admite un envío automático.';
        await this.save();
        continue;
      }
      const draft = (thread.drafts || []).find((entry) => entry.id === item.draftId);
      if (!draft || draft.status !== 'listo') {
        item.status = 'cancelled';
        item.error = 'El borrador cambió de estado antes del envío.';
        await this.save();
        continue;
      }
      const suppressions = (this.store.get('suppressions') || []).filter((suppression) => !suppression.demo);
      if (isSuppressed(thread.contact?.email, suppressions, thread.contact?.company)) {
        item.status = 'cancelled';
        item.error = 'El contacto está en la lista de no contactar.';
        await this.save();
        continue;
      }

      try {
        await this.deliver({ threadId: thread.id, draftId: draft.id });
        item.status = 'sent';
        item.sentAt = nowISO();
        await this.store.setMeta({ lastOutboxSendAt: item.sentAt });
        // La contabilidad del seguimiento vive en sendThreadMessage:
        // así vale igual para envío automático y para aprobación manual.
        await this.store.activity('outreach', `Enviado automáticamente a ${thread.contact?.company || item.email}.`, { threadId: thread.id, outboxId: item.id });
      } catch (error) {
        const message = String(error?.message || 'Error de envío');
        item.error = message;
        if (/l[ií]mite|calentamiento/i.test(message)) {
          item.runAt = nextMorningIso();
          item.note = 'Cupo diario agotado: se reprograma para mañana.';
        } else if (/suprim|no contactar|bloqueado|revisi[oó]n|revisar|ya fue enviado|no hay un borrador/i.test(message)) {
          item.status = 'cancelled';
        } else {
          item.attempts = Number(item.attempts || 0) + 1;
          if (item.attempts >= 3) {
            item.status = 'error';
            this.notify?.notify(`No pude enviar a ${thread.contact?.company || item.email}: ${message}`, { kind: 'mission_warning' }).catch(() => {});
          } else {
            item.runAt = new Date(Date.now() + RETRY_MS).toISOString();
          }
        }
      }
      await this.save();
    }
    return due.length;
  }

  async maybeFollowUps(settings) {
    const meta = this.store.get('meta') || {};
    const last = Date.parse(meta.lastFollowUpScan || 0) || 0;
    if (last && Date.now() - last < FOLLOWUP_SCAN_MS) return;
    await this.store.setMeta({ lastFollowUpScan: nowISO() });

    const suppressions = (this.store.get('suppressions') || []).filter((suppression) => !suppression.demo);
    const threads = this.store.get('threads') || [];
    const candidates = threads.filter((thread) => eligibleFollowUpThread(thread, { ...settings, __suppressions: suppressions })).slice(0, 5);
    const autopilot = this.canAutopilot(settings);
    let created = 0;
    const spacing = spacingMs(settings);

    for (const thread of candidates) {
      const mission = this.store.find('missions', thread.missionId);
      if (!mission || mission.demo) continue;
      const product = this.store.find('products', thread.productId);
      const follow = buildFollowUp(thread, product, mission);
      if (!follow) continue;
      const draft = {
        id: uid('drf'),
        channel: 'email',
        language: follow.language,
        subject: follow.subject,
        body: follow.body,
        status: autopilot ? 'listo' : 'revisar',
        source: 'seguimiento',
        followUpStep: follow.step,
        createdAt: nowISO(),
        reviewNote: autopilot ? undefined : 'Seguimiento generado automáticamente. Revisalo y aprobalo para enviarlo.',
        guardVersion: 2,
      };
      thread.drafts = [draft, ...(thread.drafts || [])];
      // El contador sube recién cuando el seguimiento sale de verdad.
      // Si queda en revisión, nextFollowUp se apaga para no generar
      // dos veces el mismo paso mientras el dueño lo aprueba.
      thread.nextFollowUp = null;
      thread.updatedAt = nowISO();
      if (autopilot) {
        const item = await this.enqueueDraft(thread, draft, {
          kind: 'seguimiento',
          step: follow.step,
          runAt: new Date(Date.now() + created * spacing).toISOString(),
        });
        if (item) created += 1;
      } else {
        created += 1;
      }
    }

    if (candidates.length) {
      await this.store.set('threads', threads);
      await this.save();
      if (created) await this.store.activity('outreach', `Seguimientos preparados: ${created}.`, {});
    }
  }

  /* Postventa (fidelización). Cuando una conversación pasa a ganado se
     agendan tres toques: día 3 agradecimiento, día 30 feedback con pedido
     de reseña/referido, día 90 reorden/novedades. El contador sube recién
     con el envío real (sendThreadMessage); si el toque queda en revisión,
     postSaleAt se fija y no se genera otra copia del mismo paso. */
  async maybePostSale(settings) {
    const suppressions = (this.store.get('suppressions') || []).filter((suppression) => !suppression.demo);
    const threads = this.store.get('threads') || [];
    const candidates = threads.filter((thread) => eligiblePostSaleThread(thread, { ...settings, __suppressions: suppressions })).slice(0, 5);
    const autopilot = this.canAutopilot(settings);
    let created = 0;
    const spacing = spacingMs(settings);

    for (const thread of candidates) {
      const mission = thread.missionId ? this.store.find('missions', thread.missionId) : null;
      if (mission?.demo) continue;
      const product = this.store.find('products', thread.productId);
      const post = buildPostSale(thread, product, settings?.brand);
      if (!post) continue;
      // Ancla de la compra: recién ganada la tenés en postSaleAt;
      // si falta, se fija la primera vez que se prepara un toque.
      if (!thread.postSaleAt) thread.postSaleAt = nowISO();
      const draft = {
        id: uid('drf'),
        channel: 'email',
        language: post.language,
        subject: post.subject,
        body: post.body,
        status: autopilot ? 'listo' : 'revisar',
        source: 'postventa',
        postSaleStep: post.step,
        createdAt: nowISO(),
        reviewNote: autopilot ? undefined : 'Postventa generada automáticamente. Revisala y aprobala para enviarla.',
        guardVersion: 2,
      };
      thread.drafts = [draft, ...(thread.drafts || [])];
      thread.updatedAt = nowISO();
      if (autopilot) {
        const item = await this.enqueueDraft(thread, draft, {
          kind: 'postventa',
          step: post.step,
          runAt: new Date(Date.now() + created * spacing).toISOString(),
        });
        if (item) created += 1;
      } else {
        created += 1;
      }
    }

    if (candidates.length) {
      await this.store.set('threads', threads);
      await this.save();
      if (created) await this.store.activity('outreach', `Postventa preparada: ${created} toque${created === 1 ? '' : 's'}.`, {});
    }
  }
}
