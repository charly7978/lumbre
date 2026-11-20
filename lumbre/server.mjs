import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

import { Store, maskSettings, settingsFlags, SECRET_PATHS } from './lib/store.mjs';
import {
  asArray, asNumber, asObject, asString, clamp, dataUrlToBuffer, localDayKey, nowISO,
  sniffImage, toCsv, truncate, uid,
} from './lib/util.mjs';
import { isAIReady, listModels, resolveAIConfig, testAI, PROVIDERS } from './lib/ai.mjs';
import { searchProviderInfo, searchWebDetailed } from './lib/search.mjs';
import { hunterAccount } from './lib/hunter.mjs';
import {
  assertCanSend, buildEml, composeEmail, dailyLimitInfo, detectOptOut, emailDomain, emlFilename,
  isSharedEmailDomain, isSuppressed, isValidEmail, normalizeCompany, normalizeEmail,
  parseEmailEvent, parseInbound, sendWithResend, sendWithWebhook, sendWithGmail, testResend,
} from './lib/email.mjs';
import { Notifier, parseWhatsAppWebhook, sendWhatsApp, telegramChats, testTelegram, testWhatsApp } from './lib/notify.mjs';
import {
  analyzeThread, askTeam, migrateLegacyDrafts, reconcileThreads, releaseInterruptedMissions, runMission, sanitizeLegacyThreads,
} from './lib/agents.mjs';
import { DEPTHS, STEPS } from './lib/prompts.mjs';
import { clearDemo, seedDemo } from './lib/demo.mjs';
import { generateJson } from './lib/ai.mjs';
import { Outbox } from './lib/outbox.mjs';
import { productReadiness } from './lib/readiness.mjs';
import { buildQuote, quoteLanguage, quoteNumber, quoteTotals, quoteTotalsMulti, roundMoney, validUntilDate } from './lib/quotes.mjs';
import { createZip, readZip } from './lib/zip.mjs';
import { fetchNewEmails } from './lib/imap.mjs';
import { diagnoseConnections, testConnection, getAiFailoverState, resetAiFailover } from './lib/connections.mjs';
import { startAutopilot, runAutopilot, getAutopilotState } from './lib/autopilot.mjs';
import { verifyMetaSignature, hasDocumentedOptIn, resendIdempotencyKey } from './lib/security.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.LUCIAN_DATA_DIR ? path.resolve(process.env.LUCIAN_DATA_DIR) : path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const VERSION = '1.0.0';
const HOST = process.env.LUCIAN_HOST || '127.0.0.1';
const START_PORT = Number(process.env.PORT || process.env.LUCIAN_PORT || 4321);
const BODY_LIMIT = 40 * 1024 * 1024;
const RESTORE_LIMIT = 160 * 1024 * 1024;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ─────────────────────────────────────────────────────────────
   Utilidades HTTP
   ───────────────────────────────────────────────────────────── */

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function fail(res, status, message) {
  json(res, status, { error: message });
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function readBody(req, limit = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > limit) {
      reject(new HttpError(413, `El archivo es demasiado grande (máximo ${Math.round(limit / 1024 / 1024)} MB).`));
      req.destroy();
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, `El contenido es demasiado grande (máximo ${Math.round(limit / 1024 / 1024)} MB).`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit = BODY_LIMIT) {
  const buffer = await readBody(req, limit);
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new HttpError(400, 'El cuerpo del pedido no es JSON válido.');
  }
}

function originAllowed(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const pathname = new URL(req.url, 'http://local').pathname;
  if (pathname.startsWith('/api/webhooks/')) return true;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function webhookTokenMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

/* "Local" de verdad: loopback y sin cabeceras de proxy/túnel. Un túnel
   (ngrok, cloudflared) también llega como 127.0.0.1, así que si hay
   cabeceras de reenvío se exige token. */
function isLocalWebhookRequest(req) {
  const remote = String(req.socket?.remoteAddress || '');
  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote);
  const forwarded = Boolean(
    req.headers['x-forwarded-for']
    || req.headers['forwarded']
    || req.headers['x-real-ip']
    || req.headers['cf-connecting-ip'],
  );
  return loopback && !forwarded;
}

/* ─────────────────────────────────────────────────────────────
   Resúmenes para la interfaz
   ───────────────────────────────────────────────────────────── */

function missionSummary(mission) {
  return {
    id: mission.id,
    demo: Boolean(mission.demo),
    productId: mission.productId,
    name: mission.name,
    goal: mission.goal,
    markets: mission.markets,
    depth: mission.depth,
    campaignId: mission.campaignId || null,
    campaignName: mission.campaignName || '',
    status: mission.status,
    phase: mission.phase,
    progress: mission.progress || 0,
    currentStep: mission.currentStep || null,
    createdAt: mission.createdAt,
    startedAt: mission.startedAt,
    finishedAt: mission.finishedAt,
    summary: mission.summary || '',
    error: mission.error || '',
    warnings: mission.warnings || [],
    notices: mission.notices || [],
    skippedProspects: mission.skippedProspects || [],
    stats: mission.stats || {},
    steps: (mission.steps || []).map((s) => ({
      id: s.id, agent: s.agent, title: s.title, status: s.status, summary: s.summary,
      error: s.error, durationMs: s.durationMs, critical: s.critical,
    })),
  };
}

function threadSummary(thread, suppressions = []) {
  const messages = thread.messages || [];
  const last = messages[messages.length - 1] || null;
  const drafts = thread.drafts || [];
  const ready = drafts.filter((d) => d.status === 'listo');
  const review = drafts.filter((d) => d.status === 'revisar');
  const blocked = drafts.filter((d) => d.status === 'bloqueado');
  const preview = ready[0] || review[0] || null;
  const applicableSuppressions = (suppressions || []).filter((item) => thread.demo || !item.demo);
  // Cotizaciones resumidas: son lo que transforma una conversación en venta.
  // Sin esto, el panel y la ruta del producto no podían mostrar ingresos sin
  // abrir hilo por hilo.
  const quotes = (thread.quotes || []).map((quote) => ({
    id: quote.id,
    number: quote.number || '',
    status: quote.status || 'borrador',
    total: Number(quote.total) || 0,
    currency: quote.currency || 'USD',
    productName: quote.productName || '',
    quantity: Number(quote.quantity) || 1,
    unitPrice: Number(quote.unitPrice) || 0,
    createdAt: quote.createdAt || null,
    sentAt: quote.sentAt || null,
    acceptedAt: quote.acceptedAt || null,
    draftId: quote.draftId || null,
  }));
  return {
    id: thread.id,
    demo: Boolean(thread.demo),
    missionId: thread.missionId,
    productId: thread.productId,
    contact: thread.contact,
    stage: thread.stage,
    score: thread.score || 0,
    source: thread.source,
    nextStep: thread.nextStep,
    nextFollowUp: thread.nextFollowUp,
    lastActivityAt: thread.lastActivityAt || thread.updatedAt,
    createdAt: thread.createdAt,
    draftCount: ready.length,
    reviewCount: review.length,
    blockedCount: blocked.length,
    pendingResends: (thread.messages || []).filter((m) => m.direction === 'out' && m.deliveryNote).length,
    suppressed: Boolean(isSuppressed(thread.contact?.email, applicableSuppressions, thread.contact?.company)),
    optOut: thread.optOut || null,
    unverified: Boolean(thread.unverified),
    unverifiedReason: thread.unverifiedReason || '',
    verification: thread.verification || null,
    messageCount: messages.length,
    awaitingReply: last?.direction === 'in',
    lastMessage: last ? { direction: last.direction, body: truncate(last.body, 180), at: last.at, subject: last.subject } : null,
    draftPreview: preview ? {
      id: preview.id,
      status: preview.status,
      subject: preview.subject,
      body: truncate(preview.body, 180),
      reviewNote: preview.reviewNote || '',
      blockedReason: preview.blockedReason || '',
    } : null,
    quotes,
  };
}

function buildIntel(missions) {
  const countries = new Map();
  const sources = new Map();
  for (const mission of missions) {
    const customs = mission.artifacts?.customs;
    for (const country of customs?.paises || []) {
      const key = String(country.pais || '').trim();
      if (!key) continue;
      const previous = countries.get(key);
      const currentVerified = Boolean(country.fuente_verificada) || country.estado_fuente === 'confirmado';
      const previousVerified = Boolean(previous?.fuente_verificada) || previous?.estado_fuente === 'confirmado';
      // Elegir fuente verificada mas reciente; si ninguna, la mas reciente sin verificar.
      const useCurrent = !previous || currentVerified || (!previousVerified);
      const chosenFuente = useCurrent ? (country.fuente || previous?.fuente || '') : (previous?.fuente || '');
      const chosenVerified = useCurrent ? currentVerified : previousVerified;
      countries.set(key, {
        pais: key,
        arancel: country.arancel_estimado || previous?.arancel || '',
        impuestos: country.impuestos || previous?.impuestos || '',
        riesgo: country.riesgo || previous?.riesgo || 'medio',
        certificaciones: country.certificaciones?.length ? country.certificaciones : previous?.certificaciones || [],
        requisitos: country.requisitos?.length ? country.requisitos : previous?.requisitos || [],
        courier: country.courier || previous?.courier || '',
        incoterm: country.incoterm || previous?.incoterm || '',
        notas: country.notas || previous?.notas || '',
        fuente: chosenFuente,
        fuente_verificada: chosenVerified,
        estado_fuente: chosenVerified ? 'confirmado' : 'no_verificado',
        misiones: [...(previous?.misiones || []), mission.name].slice(0, 5),
        demo: previous ? previous.demo && Boolean(mission.demo) : Boolean(mission.demo),
        actualizado: mission.finishedAt || mission.updatedAt,
      });
      if (country.fuente) sources.set(country.fuente, { url: country.fuente, pais: key });
    }
    for (const source of mission.artifacts?.research?.fuentes || []) {
      if (source.url) sources.set(source.url, { url: source.url, titulo: source.titulo || '', pais: '' });
    }
  }
  return {
    countries: [...countries.values()].sort((a, b) => b.misiones.length - a.misiones.length),
    sources: [...sources.values()].slice(0, 30),
  };
}

/* ─────────────────────────────────────────────────────────────
   Ventas e ingresos: la respuesta a "¿dónde veo lo que vendí?".
   Una venta es una conversación en etapa "ganado" o una cotización
   aceptada. Los números salen de los datos, no de una planilla aparte.
   ───────────────────────────────────────────────────────────── */

const QUOTE_STATUS_LABELS = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

function buildSales(threads, products, currency = 'USD') {
  const productName = (id) => products.find((product) => product.id === id)?.name || 'Producto';
  const quotes = threads.flatMap((thread) => (thread.quotes || []).map((quote) => ({
    ...quote,
    threadId: thread.id,
    company: thread.contact?.company || thread.contact?.name || 'Contacto',
    productId: thread.productId,
    productName: productName(thread.productId),
    stage: thread.stage,
  })));
  const accepted = quotes.filter((quote) => quote.status === 'aceptada');
  const revenue = roundMoney(accepted.reduce((acc, quote) => acc + (Number(quote.total) || 0), 0));
  const wonThreads = threads
    .filter((thread) => thread.stage === 'ganado')
    .map((thread) => {
      const quote = (thread.quotes || []).find((item) => item.status === 'aceptada') || (thread.quotes || [])[0];
      return {
        threadId: thread.id,
        company: thread.contact?.company || thread.contact?.name || 'Contacto',
        productId: thread.productId,
        productName: productName(thread.productId),
        quoteNumber: quote?.number || '',
        total: Number(quote?.total) || 0,
        currency: quote?.currency || currency,
        acceptedAt: quote?.acceptedAt || null,
        at: quote?.acceptedAt || thread.updatedAt || thread.createdAt,
      };
    })
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
  const openQuotes = quotes
    .filter((quote) => ['borrador', 'enviada'].includes(quote.status))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const byProduct = {};
  for (const quote of quotes) {
    const key = quote.productId || 'sin-producto';
    const bucket = byProduct[key] || {
      productId: key,
      productName: productName(quote.productId),
      quotes: 0,
      accepted: 0,
      revenue: 0,
      sold: 0,
    };
    bucket.quotes += 1;
    if (quote.status === 'aceptada') {
      bucket.accepted += 1;
      bucket.revenue = roundMoney(bucket.revenue + (Number(quote.total) || 0));
    }
    byProduct[key] = bucket;
  }
  for (const thread of threads.filter((item) => item.stage === 'ganado')) {
    const key = thread.productId || 'sin-producto';
    const bucket = byProduct[key] || {
      productId: key,
      productName: productName(thread.productId),
      quotes: 0,
      accepted: 0,
      revenue: 0,
      sold: 0,
    };
    bucket.sold += 1;
    byProduct[key] = bucket;
  }
  return {
    currency,
    sold: wonThreads.length,
    revenue,
    acceptedQuotes: accepted.length,
    openQuotes: openQuotes.length,
    quotesByStatus: quotes.reduce((acc, quote) => {
      acc[quote.status] = (acc[quote.status] || 0) + 1;
      return acc;
    }, {}),
    quoteStatusLabels: QUOTE_STATUS_LABELS,
    won: wonThreads,
    open: openQuotes.map((quote) => ({
      id: quote.id,
      threadId: quote.threadId,
      company: quote.company,
      productId: quote.productId,
      productName: quote.productName,
      number: quote.number,
      status: quote.status,
      statusLabel: QUOTE_STATUS_LABELS[quote.status] || quote.status,
      total: Number(quote.total) || 0,
      currency: quote.currency || currency,
      createdAt: quote.createdAt,
    })),
    byProduct: Object.values(byProduct),
  };
}

/* ─────────────────────────────────────────────────────────────
   Arranque
   ───────────────────────────────────────────────────────────── */

const store = new Store(DATA_DIR);
await store.init();
const legacyMigration = await migrateLegacyDrafts(store);
if (legacyMigration.changed) {
  console.log(`  Migración de guardas: ${legacyMigration.changed} borrador(es) revisados.`);
}
const unverifiedMigration = await sanitizeLegacyThreads(store);
if (unverifiedMigration.changed) {
  console.log(`  Verificación de hilos históricos: ${unverifiedMigration.changed} marcados${unverifiedMigration.discarded ? `, ${unverifiedMigration.discarded} borradores descartados` : ''}.`);
}
const interrupted = await releaseInterruptedMissions(store);
if (interrupted.released) {
  console.log(`  Misiones interrumpidas liberadas: ${interrupted.released} (quedan reintentables).`);
}

const listeners = new Map();
function broadcast(missionId, event) {
  const set = listeners.get(missionId);
  if (!set) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of [...set]) {
    try { res.write(payload); } catch { set.delete(res); }
  }
}

const notifier = new Notifier({
  store,
  ask: async (question, channel = 'web', history = [], images = []) => {
    const result = await askTeam({ question, agentId: 'director', store, history, channel, images });
    return result.demo ? `(Modo demo) ${result.answer}` : result.answer;
  },
  actions: { createMission, sendThreadMessage, createQuote, analyzeThread },
});
notifier.start();

const outbox = new Outbox({
  store,
  deliver: async ({ threadId, draftId }) => {
    const settings = store.settings();
    let channel = 'manual';
    if (settings.email?.provider === 'resend' && settings.email?.resendKey) channel = 'resend';
    else if (settings.email?.provider === 'gmail' && settings.email?.smtpUser && settings.email?.smtpPassword) channel = 'gmail';
    else if (settings.email?.webhookUrl) channel = 'webhook';
    return sendThreadMessage(threadId, { draftId, channel, automated: true });
  },
  notify: notifier,
});
outbox.start();

/* ─────────────────────────────────────────────────────────────
   Correo entrante por IMAP (Gmail): cada cierto tiempo se conecta
   a Gmail, lee los correos nuevos y los procesa igual que el webhook.
   No necesita dominio ni túnel: la conexión sale de esta PC.
   ───────────────────────────────────────────────────────────── */
let imapBusy = false;
let imapTimer = null;

async function pollGmailInbox() {
  const settings = store.settings();
  const email = settings.email || {};
  if (email.provider !== 'gmail' || !email.smtpUser || !email.smtpPassword || email.imapEnabled === false) return;
  if (imapBusy) return;
  imapBusy = true;
  try {
    const meta = store.get('meta') || {};
    const sinceUid = Number(meta.gmailLastUid) || 0;
    const messages = await fetchNewEmails({
      user: email.smtpUser,
      appPassword: email.smtpPassword,
      sinceUid,
      limit: 20,
    });
    let maxUid = sinceUid;
    for (const msg of messages) {
      try {
        await processInboundEmail({
          from: msg.from,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
          messageId: msg.messageId,
          inReplyTo: msg.inReplyTo,
          references: msg.references,
        });
        if (msg.uid > maxUid) maxUid = msg.uid;
      } catch (error) {
        console.error('[Lucian] No se pudo procesar un correo entrante:', error.message);
      }
    }
    if (maxUid !== sinceUid) await store.setMeta({ gmailLastUid: maxUid });
  } catch (error) {
    console.error('[Lucian] IMAP Gmail:', error.message);
  } finally {
    imapBusy = false;
  }
}

function startImapPolling() {
  if (imapTimer) clearInterval(imapTimer);
  const settings = store.settings();
  const email = settings.email || {};
  if (email.provider !== 'gmail' || !email.smtpUser || !email.smtpPassword) return;
  const minutes = Math.max(1, Math.min(60, Number(email.imapPollMinutes) || 2));
  imapTimer = setInterval(pollGmailInbox, minutes * 60 * 1000);
  imapTimer.unref?.();
  // Primera pasada shortly after start
  setTimeout(() => pollGmailInbox(), 5000).unref?.();
  console.log(`  Correo entrante (IMAP Gmail): cada ${minutes} min`);
}
startImapPolling();
const autopilotDeps = { createMission };
startAutopilot(store, notifier, (line) => console.log(line), autopilotDeps);

/* Extrae el procesamiento de un correo entrante para reutilizarlo
   desde el webhook y desde IMAP. Devuelve el hilo afectado. */
async function processInboundEmail(inbound) {
  const emailMatch = String(inbound.from || '').match(/<([^>]+)>/);
  const email = (emailMatch ? emailMatch[1] : inbound.from || '').trim().toLowerCase();
  if (!isValidEmail(email)) throw new Error('El remitente no es un email válido.');
  let thread = findThreadForEmail(email, inbound);
  if (!thread) thread = await createInboundThread(inbound, email);
  const now = nowISO();
  const message = {
    id: uid('msg'),
    direction: 'in',
    channel: 'email',
    subject: inbound.subject || '(sin asunto)',
    body: truncate(inbound.text || inbound.html, 30000),
    at: now,
    status: 'recibido',
    ...(inbound.messageId ? { messageId: inbound.messageId } : {}),
    ...(inbound.inReplyTo ? { inReplyTo: inbound.inReplyTo } : {}),
    ...(inbound.references?.length ? { references: inbound.references.join(' ') } : {}),
  };
  thread.messages = [...(thread.messages || []), message];
  thread.lastActivityAt = now;
  thread.updatedAt = now;
  const optOut = await registerOptOut(thread, `${inbound.subject || ''}\n${message.body || ''}`, 'imap');
  if (!optOut && thread.stage === 'contactado') thread.stage = 'respondio';
  await store.set('threads', store.get('threads'));
  await store.activity('reply', `Respuesta de ${email}: ${truncate(inbound.subject || message.body, 140)}`, { threadId: thread.id });

  if (optOut) {
    await notifier.notify(`${thread.contact?.company || email} pidió no recibir más mensajes.`, { kind: 'opt_out' }).catch(() => {});
  } else if (isAIReady(store.settings())) {
    try {
      const result = await analyzeThread({ thread, store, apply: true });
      if (result.analysis.score >= 75) {
        await notifier.notify(
          `Respuesta caliente de ${thread.contact?.company || email}.\n\n${truncate(message.body, 500)}\n\nSiguiente paso: ${result.analysis.siguiente_paso || 'revisar la conversación'}.`,
          { kind: 'hot_reply' },
        ).catch(() => {});
      }
    } catch { /* la respuesta ya quedó guardada */ }
  }
  return thread;
}

/* Una campaña de catálogo puede dejar misiones en cola durante horas. Si
   Lucian se reinicia, esos temporizadores en memoria se pierden. Acá se
   retoman las misiones que nunca llegaron a empezar, en orden de creación.
   Las que estaban "running" las libera releaseInterruptedMissions para que
   el dueño pueda reintentarlas sin perder lo ya hecho. */
function resumeQueuedMissions() {
  const queued = store.get('missions')
    .filter((mission) => mission && mission.status === 'queued')
    .sort((a, b) => (Date.parse(a.createdAt || 0) || 0) - (Date.parse(b.createdAt || 0) || 0));
  for (const mission of queued) {
    setTimeout(() => {
      runMission(mission.id, {
        store,
        broadcast,
        notifier,
        onMissionFinished: (finished) => outbox.scheduleMission(finished),
      }).catch((error) => console.error('[Lucian] No se pudo retomar una misión en cola:', error));
    }, 500);
  }
  return queued.length;
}
const resumedQueued = resumeQueuedMissions();
if (resumedQueued) console.log(`  Misiones en cola retomadas: ${resumedQueued}.`);

function statePayload() {
  const settings = store.settings();
  const products = store.get('products');
  const missions = store.get('missions');
  const threads = store.get('threads');
  const content = store.get('content');
  const learnings = store.get('learnings');
  const suppressions = store.get('suppressions');
  const activity = store.get('activity');
  const flags = settingsFlags(settings);
  const meta = store.get('meta');
  const activeMissions = missions.filter((m) => ['running', 'queued'].includes(m.status));
  const finishedMissions = missions.filter((m) => ['done', 'done_with_warnings'].includes(m.status));
  const readyDrafts = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'listo').length, 0);
  const reviewDrafts = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'revisar').length, 0);
  const blockedDrafts = threads.reduce((acc, t) => acc + (t.drafts || []).filter((d) => d.status === 'bloqueado').length, 0);
  const hot = threads.filter((t) => ['interesado', 'negociando'].includes(t.stage));
  const latestDone = [...finishedMissions]
    .sort((a, b) => new Date(b.finishedAt || b.createdAt || 0) - new Date(a.finishedAt || a.createdAt || 0))[0];
  const latestPlan = latestDone?.artifacts?.synthesis
    ? { ...latestDone.artifacts.synthesis, mission: { id: latestDone.id, name: latestDone.name, warnings: latestDone.warnings || [] } }
    : null;

  return {
    app: { name: 'Lucian', version: VERSION, now: nowISO(), demoMode: flags.demo, dataDir: store.dataDir },
    latestPlan,
    brand: settings.brand,
    settings: maskSettings(settings),
    flags,
    onboarding: settings.onboarding,
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, ...p })),
    products,
    missions: missions.map(missionSummary),
    threads: threads.map((thread) => threadSummary(thread, suppressions)),
    content,
    learnings,
    suppressions,
    activity: activity.slice(0, 16),
    counts: {
      products: products.length,
      missions: missions.length,
      activeMissions: activeMissions.length,
      doneMissions: finishedMissions.length,
      warningMissions: missions.filter((m) => m.status === 'done_with_warnings').length,
      threads: threads.length,
      hot: hot.length,
      awaitingReply: threads.filter((t) => (t.messages || []).slice(-1)[0]?.direction === 'in').length,
      drafts: readyDrafts,
      draftsToReview: reviewDrafts,
      draftsBlocked: blockedDrafts,
      content: content.length,
      contentIdeas: content.filter((c) => c.status === 'idea').length,
      learnings: learnings.length,
      suppressions: suppressions.length,
      replies: threads.reduce((acc, t) => acc + (t.messages || []).filter((m) => m.direction === 'in').length, 0),
    },
    funnel: {
      stages: ['nuevo', 'contactado', 'respondio', 'interesado', 'negociando', 'ganado', 'perdido']
        .reduce((acc, stage) => ({ ...acc, [stage]: threads.filter((t) => t.stage === stage).length }), {}),
      quotes: (threads.flatMap((t) => t.quotes || [])).reduce((acc, q) => {
        acc[q.status] = (acc[q.status] || 0) + 1;
        return acc;
      }, {}),
      missions: ['queued', 'running', 'done', 'done_with_warnings', 'error', 'cancelled']
        .reduce((acc, status) => ({ ...acc, [status]: missions.filter((m) => m.status === status).length }), {}),
      sold: threads.filter((t) => t.stage === 'ganado').length,
      suppressed: suppressions.length,
    },
    limits: dailyLimitInfo(settings, threads),
    sales: buildSales(threads, products, settings.brand?.currency || 'USD'),
    outbox: outbox.status(),
    usage: meta.agentUsage || {},
    intel: buildIntel(missions),
  };
}

/* ─────────────────────────────────────────────────────────────
   Productos
   ───────────────────────────────────────────────────────────── */

async function processPhotos(input, existing, product) {
  const oldPhotos = existing?.photos || [];
  const oldFiles = new Set(oldPhotos.map((p) => p.file));
  if (input === undefined) return { photos: oldPhotos, removed: [] };
  const list = asArray(input).slice(0, 6);
  const photos = [];
  for (const item of list) {
    const obj = asObject(item);
    if (obj.dataUrl) {
      const { buffer } = dataUrlToBuffer(obj.dataUrl);
      const kind = sniffImage(buffer);
      if (!kind) throw new HttpError(400, 'Una foto no es JPG, PNG, WEBP o GIF válido.');
      const saved = await store.saveMedia(buffer, kind.ext, 'products', asString(obj.alt) || product.name);
      photos.push(saved);
    } else if (obj.file && oldFiles.has(asString(obj.file))) {
      photos.push({
        file: obj.file,
        alt: asString(obj.alt) || oldPhotos.find((p) => p.file === obj.file)?.alt || product.name,
      });
    }
  }
  const removed = [...oldFiles].filter((file) => !photos.some((p) => p.file === file));
  return { photos, removed };
}

function validatePaymentLink(value) {
  const raw = asString(value).trim().slice(0, 500);
  if (!raw) return '';
  let parsed;
  try { parsed = new URL(raw); } catch { parsed = null; }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
    throw new HttpError(400, 'El link de pago debe ser una dirección http(s) válida.');
  }
  return parsed.href;
}

function productFields(body, existing, id) {
  const name = asString(body.name ?? existing?.name).trim();
  if (!name) throw new HttpError(400, 'El producto necesita un nombre.');
  const price = body.price === undefined ? Number(existing?.price ?? 0) : asNumber(body.price);
  const status = ['borrador', 'listo', 'archivado'].includes(body.status) ? body.status : existing?.status || 'borrador';
  const paymentLink = validatePaymentLink(body.paymentLink ?? existing?.paymentLink);
  return {
    name,
    code: asString(body.code ?? existing?.code).trim() || existing?.code || `LUM-${id.slice(-4).toUpperCase()}`,
    category: asString(body.category ?? existing?.category, 'Lámpara'),
    price: Math.max(0, price),
    currency: asString(body.currency ?? existing?.currency, store.settings().brand.currency || 'USD').toUpperCase().slice(0, 6),
    cost: body.cost === undefined ? Number(existing?.cost ?? 0) : Math.max(0, asNumber(body.cost)),
    weightGrams: body.weightGrams === undefined ? Number(existing?.weightGrams ?? 0) : Math.max(0, asNumber(body.weightGrams)),
    capacityPerWeek: body.capacityPerWeek === undefined ? Number(existing?.capacityPerWeek ?? 0) : Math.max(0, Math.round(asNumber(body.capacityPerWeek))),
    leadTimeDays: body.leadTimeDays === undefined ? Number(existing?.leadTimeDays ?? 0) : Math.max(0, Math.round(asNumber(body.leadTimeDays))),
    dimensions: asString(body.dimensions ?? existing?.dimensions),
    materials: asString(body.materials ?? existing?.materials),
    description: asString(body.description ?? existing?.description),
    notes: asString(body.notes ?? existing?.notes),
    paymentLink,
    status,
  };
}

/* Importación de catálogo por CSV. Sin dependencias y tolerante a exceles:
   acepta coma o punto y coma, encabezados en español o inglés y números con
   coma decimal. No crea duplicados por código ni por nombre. */
function parseCsvRows(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') { quoted = true; continue; }
    if (char === delimiter) { row.push(field); field = ''; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (char === '\r') continue;
    field += char;
  }
  row.push(field);
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows.filter((cells) => cells.some((cell) => String(cell).trim()));
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
}

function csvNumber(value) {
  const raw = String(value ?? '').replace(/[^\d.,-]/g, '').trim();
  if (!raw) return 0;
  if (raw.includes(',') && raw.includes('.')) return asNumber(raw.replace(/\./g, '').replace(',', '.'), 0);
  return asNumber(raw.replace(',', '.'), 0);
}

const CSV_ALIASES = {
  name: ['nombre', 'name', 'producto', 'product', 'titulo', 'title'],
  code: ['codigo', 'code', 'sku', 'referencia', 'ref'],
  category: ['categoria', 'category', 'tipo', 'type'],
  price: ['precio', 'price', 'precioventa', 'preciodeventa', 'saleprice'],
  cost: ['costo', 'cost', 'coste', 'costoproduccion', 'productioncost'],
  currency: ['moneda', 'currency', 'divisa'],
  status: ['estado', 'status', 'situacion'],
  description: ['descripcion', 'description', 'detalle', 'detalles'],
  notes: ['notas', 'notes', 'observaciones', 'comentarios'],
  materials: ['materiales', 'materials', 'material', 'terminacion'],
  weightGrams: ['peso', 'pesogramos', 'weight', 'weightgrams', 'pesogr'],
  dimensions: ['medidas', 'dimensions', 'dimensiones', 'tamano'],
  capacityPerWeek: ['capacidad', 'capacidadsemanal', 'unidadessemana', 'unidadessemanales', 'capacity', 'capacityperweek', 'produccionsemanal'],
  leadTimeDays: ['plazo', 'plazodias', 'diasfabricacion', 'diasdeproduccion', 'leadtime', 'leadtimedays', 'tiempodeentrega'],
  paymentLink: ['pago', 'linkdepago', 'linkpago', 'paymentlink', 'payment', 'checkout'],
};

function mapCsvRow(headers, cells) {
  const values = {};
  headers.forEach((header, index) => {
    for (const [key, aliases] of Object.entries(CSV_ALIASES)) {
      if (aliases.includes(header)) { values[key] = cells[index] ?? ''; break; }
    }
  });
  return values;
}

async function importProductsCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) throw new HttpError(400, 'El CSV necesita una fila de encabezados y al menos un producto.');
  if (rows.length > 501) throw new HttpError(400, 'Máximo 500 productos por importación. Dividí el archivo.');
  const headers = rows[0].map(normalizeHeader);
  if (!headers.some((header) => CSV_ALIASES.name.includes(header))) {
    throw new HttpError(400, 'Falta la columna de nombre. Usá "nombre" o "name" en la primera fila.');
  }
  const products = store.get('products');
  const existingCodes = new Set(products.map((product) => String(product.code || '').toLowerCase()).filter(Boolean));
  const existingNames = new Set(products.map((product) => normalizeCompany(product.name)));
  const now = nowISO();
  const created = [];
  const skipped = [];
  const errors = [];

  for (let index = 1; index < rows.length; index += 1) {
    const values = mapCsvRow(headers, rows[index]);
    const name = asString(values.name).trim();
    if (!name) { errors.push({ row: index + 1, reason: 'sin nombre' }); continue; }
    const code = asString(values.code).trim();
    if (code && existingCodes.has(code.toLowerCase())) { skipped.push({ row: index + 1, name, reason: `código ${code} ya existe` }); continue; }
    if (existingNames.has(normalizeCompany(name))) { skipped.push({ row: index + 1, name, reason: 'nombre ya existe' }); continue; }
    const id = uid('prd');
    const fields = productFields({
      name,
      code,
      category: asString(values.category).trim() || 'Lámpara',
      price: csvNumber(values.price),
      cost: csvNumber(values.cost),
      currency: asString(values.currency).trim() || store.settings().brand.currency || 'USD',
      status: asString(values.status).trim() || 'borrador',
      description: asString(values.description),
      notes: asString(values.notes),
      materials: asString(values.materials),
      weightGrams: csvNumber(values.weightGrams),
      dimensions: asString(values.dimensions),
      capacityPerWeek: csvNumber(values.capacityPerWeek),
      leadTimeDays: csvNumber(values.leadTimeDays),
      paymentLink: asString(values.paymentLink).trim().slice(0, 500),
    }, null, id);
    const product = { id, ...fields, photos: [], demo: false, createdAt: now, updatedAt: now };
    products.unshift(product);
    existingNames.add(normalizeCompany(name));
    if (product.code) existingCodes.add(product.code.toLowerCase());
    created.push({ id, name: product.name, code: product.code });
  }

  if (created.length) {
    await store.set('products', products);
    await store.activity('product', `Importación CSV: ${created.length} productos creados.`, { created: created.length });
  }
  return { created: created.length, products: created, skipped, errors };
}

async function createProduct(body) {
  const id = uid('prd');
  const fields = productFields(body, null, id);
  const { photos } = await processPhotos(body.photos === undefined ? [] : body.photos, null, fields);
  const now = nowISO();
  const product = { id, ...fields, photos, demo: false, createdAt: now, updatedAt: now };
  store.get('products').unshift(product);
  await store.set('products', store.get('products'));
  await store.activity('product', `Producto creado: ${product.name}.`, { productId: id });
  return product;
}

async function updateProduct(id, body) {
  const products = store.get('products');
  const index = products.findIndex((p) => p.id === id);
  if (index === -1) throw new HttpError(404, 'Producto no encontrado.');
  const existing = products[index];
  const fields = productFields(body, existing, id);
  const { photos, removed } = await processPhotos(body.photos, existing, fields);
  const updated = { ...existing, ...fields, photos, updatedAt: nowISO() };
  products[index] = updated;
  await store.set('products', products);
  for (const file of removed) await store.removeMedia(file);
  await store.activity('product', `Producto actualizado: ${updated.name}.`, { productId: id });
  return updated;
}

/* ─────────────────────────────────────────────────────────────
   Misiones
   ───────────────────────────────────────────────────────────── */

async function createMission(body) {
  const settings = store.settings();
  const product = store.find('products', asString(body.productId));
  if (!product) throw new HttpError(400, 'Elegí un producto válido para lanzar la misión.');
  if (product.status === 'archivado') {
    throw new HttpError(400, 'Ese producto está archivado. Reactivalo antes de lanzar una misión.');
  }

  const depth = DEPTHS[body.depth] ? body.depth : settings.mission.depth || 'estandar';
  const markets = [...new Set(asArray(body.markets).map((m) => asString(m).trim()).filter(Boolean))].slice(0, 6);
  const finalMarkets = markets.length ? markets : asArray(settings.mission.markets).slice(0, 6);
  const requestedMode = ['auto', 'real', 'demo'].includes(body.mode) ? body.mode : 'auto';
  const demo = requestedMode === 'demo' || (requestedMode === 'auto' && !isAIReady(settings));
  if (requestedMode === 'real' && !isAIReady(settings)) {
    throw new HttpError(400, 'Para lanzar una misión real primero configurá una IA en Ajustes.');
  }
  if (!finalMarkets.length) {
    throw new HttpError(400, 'Elegí al menos un mercado para la misión. Sin mercado no hay a quién venderle.');
  }
  // Una misión real gasta búsquedas y tokens: no se lanza con una ficha que
  // no puede sostener una conversación de venta. Las demos siguen libres para
  // que el dueño pueda probar antes de cargar todo.
  if (!demo) {
    const readiness = productReadiness(product);
    if (!readiness.readyForProspecting) {
      const missing = readiness.missing.filter((item) => item.critical).map((item) => item.label).join('; ')
        || 'completá la foto y el precio';
      throw new HttpError(400, `El producto no está listo para una misión real: ${missing}.`);
    }
  }

  const id = uid('mis');
  const now = nowISO();
  const steps = DEPTHS[depth].steps.map((stepId) => {
    const def = STEPS[stepId];
    return {
      id: stepId,
      agent: def.agent,
      title: def.title,
      status: 'pending',
      critical: Boolean(def.critical),
      startedAt: null,
      endedAt: null,
      durationMs: null,
      summary: '',
      error: null,
      tokens: 0,
    };
  });

  const mission = {
    id,
    demo,
    mode: demo ? 'demo' : 'real',
    requestedMode,
    productId: product.id,
    name: asString(body.name).trim() || `${product.name} · ${finalMarkets[0] || 'Mercado global'}`,
    goal: asString(body.goal, 'conseguir-mayoristas'),
    markets: finalMarkets,
    depth,
    tone: asString(body.tone, settings.mission.tone || 'cercano, experto, sin presión'),
    budget: Math.max(0, asNumber(body.budget, 0)),
    maxProspects: clamp(asNumber(body.maxProspects, settings.mission.maxProspects || 12), 1, 40),
    notes: asString(body.notes),
    campaignId: asString(body.campaignId) || null,
    campaignName: asString(body.campaignName) || '',
    status: 'queued',
    phase: 'queued',
    progress: 0,
    currentStep: null,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    summary: '',
    error: null,
    steps,
    artifacts: {},
    log: [],
    stats: {},
    warnings: [],
    notices: [],
    skippedProspects: [],
    cancelRequested: false,
  };

  store.get('missions').unshift(mission);
  await store.set('missions', store.get('missions'));
  await store.activity('mission', `Misión creada: ${mission.name}${demo ? ' (demo)' : ''}.`, { missionId: id, demo });
  setTimeout(() => {
    runMission(id, { store, broadcast, notifier, onMissionFinished: (mission) => outbox.scheduleMission(mission) }).catch((error) => {
      console.error('[Lucian] Error no controlado en la misión:', error);
    });
  }, 80);
  return mission;
}

/* Campaña de catálogo: una misión por producto, en cola.
   La estrategia "rotate" asigna un mercado distinto a cada producto para no
   golpear la misma lista de compradores con todo el catálogo el mismo día.
   Es la forma correcta de cargar 20 artículos sin convertir la bandeja en
   un embudo de duplicados. */
async function createCampaign(body = {}) {
  const settings = store.settings();
  const requested = asArray(body.productIds).map((id) => asString(id)).filter(Boolean);
  const all = store.get('products');
  const pool = (requested.length ? all.filter((product) => requested.includes(product.id)) : all)
    .filter((product) => product.status !== 'archivado')
    .sort((a, b) => (a.status === 'listo' ? -1 : 0) - (b.status === 'listo' ? -1 : 0));
  if (!pool.length) throw new HttpError(400, 'No hay productos activos para lanzar una campaña.');
  const requestedMode = ['auto', 'real', 'demo'].includes(body.mode) ? body.mode : 'auto';
  const demo = requestedMode === 'demo' || (requestedMode === 'auto' && !isAIReady(settings));
  if (requestedMode === 'real' && !isAIReady(settings)) {
    throw new HttpError(400, 'Para lanzar una campaña real primero configurá una IA en Ajustes.');
  }
  const active = new Set(store.get('missions').filter((mission) => ['running', 'queued'].includes(mission.status)).map((mission) => mission.productId));
  const markets = [...new Set(asArray(body.markets).map((market) => asString(market).trim()).filter(Boolean))].slice(0, 6);
  const finalMarkets = markets.length ? markets : asArray(settings.mission.markets).slice(0, 6);
  if (!finalMarkets.length) {
    throw new HttpError(400, 'Elegí al menos un mercado para la campaña. Sin mercado no hay a quién venderle.');
  }
  const strategy = body.marketStrategy === 'all' ? 'all' : 'rotate';
  const depth = DEPTHS[body.depth] ? body.depth : settings.mission.depth || 'estandar';
  const campaignId = uid('cmp');
  const campaignName = asString(body.name).trim() || `Catálogo · ${new Date().toISOString().slice(0, 10)}`;
  const created = [];
  const skipped = [];

  for (let index = 0; index < pool.length; index += 1) {
    const product = pool[index];
    if (active.has(product.id)) {
      skipped.push({ productId: product.id, name: product.name, reason: 'ya tiene una misión en curso' });
      continue;
    }
    // Con IA real, cada producto debe poder sostener una conversación. Se
    // saltea la ficha incompleta en vez de gastar una misión y descubrirlo
    // cuando el comprador pregunta precio o medidas.
    if (!demo) {
      const readiness = productReadiness(product);
      if (!readiness.readyForProspecting) {
        const missing = readiness.missing.filter((item) => item.critical).map((item) => item.label).join('; ');
        skipped.push({ productId: product.id, name: product.name, reason: `faltan datos críticos: ${missing}` });
        continue;
      }
    }
    const assigned = strategy === 'rotate'
      ? [finalMarkets[index % finalMarkets.length]].filter(Boolean)
      : finalMarkets;
    try {
      const mission = await createMission({
        ...body,
        // El nombre de la campaña describe el lote; cada misión se nombra
        // por su producto y mercado para que la bandeja siga siendo legible.
        name: `${product.name} · ${assigned[0] || 'Mercado global'}`,
        productId: product.id,
        markets: assigned,
        depth,
        campaignId,
        campaignName,
      });
      created.push({ id: mission.id, name: mission.name, productId: product.id, markets: mission.markets });
      active.add(product.id);
    } catch (error) {
      skipped.push({ productId: product.id, name: product.name, reason: error.message || 'no se pudo crear' });
    }
  }

  if (!created.length) throw new HttpError(400, 'No se pudo crear ninguna misión. Revisá los productos y los mercados.');
  await store.activity('mission', `Campaña creada: ${campaignName}. ${created.length} misiones en cola.`, { campaignId });
  return { campaignId, name: campaignName, strategy, markets: finalMarkets, created, skipped };
}

async function retryMission(id) {
  const mission = store.find('missions', id);
  if (!mission) throw new HttpError(404, 'Misión no encontrada.');
  if (['running', 'queued'].includes(mission.status)) throw new HttpError(409, 'La misión ya está en curso.');
  const previousWarnings = Array.isArray(mission.warnings) ? [...mission.warnings] : [];
  mission.status = 'queued';
  mission.error = null;
  mission.finishedAt = null;
  mission.cancelRequested = false;
  mission.currentStep = null;
  mission.warnings = [];
  mission.notices = [];
  mission.artifacts = mission.artifacts || {};

  const pipeline = (DEPTHS[mission.depth] || DEPTHS.estandar).steps;
  let resetFrom = -1;
  for (const step of mission.steps || []) {
    if (step.status === 'error') {
      const index = pipeline.indexOf(step.id);
      if (index >= 0 && (resetFrom < 0 || index < resetFrom)) resetFrom = index;
    }
  }
  // Un aviso de red team, cumplimiento o "sin compradores" también se puede
  // reintentar: hay que volver a ejecutar desde el paso que lo generó.
  for (const warning of previousWarnings) {
    const index = pipeline.indexOf(warning.step);
    if (index >= 0 && (resetFrom < 0 || index < resetFrom)) resetFrom = index;
  }
  // Una misión sin compradores verificados no se arregla reintentando el
  // último paso: hay que volver a prospectar y reconstruir todo lo que
  // dependía de la lista vacía.
  const prospects = (mission.artifacts?.prospecting?.compradores || []).length;
  if (!mission.demo && prospects === 0) {
    const prospectIndex = pipeline.indexOf('prospecting');
    if (prospectIndex >= 0 && (resetFrom < 0 || prospectIndex < resetFrom)) resetFrom = prospectIndex;
  }

  for (let index = 0; index < (mission.steps || []).length; index += 1) {
    const step = mission.steps[index];
    const position = pipeline.indexOf(step.id);
    const shouldReset = step.status === 'error' || (resetFrom >= 0 && position >= resetFrom);
    if (!shouldReset) continue;
    step.status = 'pending';
    step.error = null;
    step.endedAt = null;
    step.durationMs = null;
    step.summary = '';
    step.tokens = 0;
    delete mission.artifacts[step.id];
  }
  if (resetFrom >= 0) {
    // Nada de lo que se iba a crear con una lista vacía queda como definitivo.
    mission.stats = { ...(mission.stats || {}), prospects: 0 };
    const staleThreads = store.get('threads').filter((thread) => thread.missionId === id && !(thread.messages || []).length);
    if (staleThreads.length) {
      // No se borran conversaciones con actividad; las vacías se reconcilian
      // al final de la nueva corrida.
      for (const thread of staleThreads) {
        for (const draft of thread.drafts || []) {
          if (draft.status === 'enviado') continue;
          draft.status = 'descartado';
          draft.discardedAt = nowISO();
          draft.discardReason = 'La misión se está reejecutando para verificar compradores.';
        }
      }
      await store.set('threads', store.get('threads'));
    }
  }
  await store.set('missions', store.get('missions'));
  const done = (mission.steps || []).filter((s) => s.status === 'done').length;
  mission.progress = Math.round((done / Math.max(1, mission.steps.length)) * 100);
  await store.activity('mission', `Misión reintentada: ${mission.name}.`, { missionId: id });
  setTimeout(() => runMission(id, { store, broadcast, notifier, onMissionFinished: (mission) => outbox.scheduleMission(mission) }).catch((error) => console.error(error)), 80);
  return mission;
}

/* ─────────────────────────────────────────────────────────────
   Hilos y envío
   ───────────────────────────────────────────────────────────── */

function threadSuppressions(thread) {
  return (store.get('suppressions') || []).filter((item) => thread.demo || !item.demo);
}

/* El dominio del Message-ID sale del remitente real: si el dueño usa su
   propio dominio, los filtros de correo ven coherencia entre From y el hilo. */
function messageIdDomain(settings) {
  const raw = String(settings?.email?.from || settings?.brand?.email || '').trim();
  const email = raw.includes('<') ? (raw.match(/<([^>]+)>/)?.[1] || '') : raw;
  const domain = String(email).split('@')[1]?.trim().toLowerCase() || '';
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain : 'lucian.local';
}

function newMessageId(settings) {
  return `<lucian-${crypto.randomUUID()}@${messageIdDomain(settings)}>`;
}

function lastInboundMessage(thread) {
  return [...(thread?.messages || [])].reverse().find((message) => message.direction === 'in' && message.messageId) || null;
}

/* Cerrar una venta reinicia la postventa desde hoy y descarta cualquier
   seguimiento frío que estuviera por salir. Se usa tanto al mover la etapa a
   mano como al aceptar una cotización. */
async function markThreadWon(thread) {
  const now = nowISO();
  thread.stage = 'ganado';
  thread.postSaleAt = now;
  thread.postSaleCount = 0;
  thread.nextFollowUp = null;
  thread.updatedAt = now;
  thread.drafts = (thread.drafts || []).filter((draft) => !(
    draft.source === 'postventa' && ['listo', 'revisar'].includes(draft.status)
  ));
  for (const draft of thread.drafts || []) {
    if (draft.source !== 'seguimiento' || !['listo', 'revisar'].includes(draft.status)) continue;
    draft.status = 'descartado';
    draft.discardedAt = now;
    draft.discardReason = 'La conversación pasó a ganado: no corresponde un seguimiento frío.';
  }
  let changed = false;
  for (const item of outbox.items()) {
    if (item.status !== 'pending' || item.threadId !== thread.id || item.kind === 'postventa') continue;
    item.status = 'cancelled';
    item.error = 'La conversación pasó a ganado.';
    changed = true;
  }
  if (changed) await outbox.save();
  return thread;
}

async function nextQuoteNumber() {
  const meta = store.get('meta') || {};
  const sequence = Math.max(0, Number(meta.quoteSequence) || 0) + 1;
  await store.setMeta({ quoteSequence: sequence });
  return quoteNumber(new Date(), sequence);
}

async function createQuote(threadId, body = {}) {
  const threads = store.get('threads');
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
  const settings = store.settings();
  const product = store.find('products', asString(body.productId) || thread.productId);
  if (!product) throw new HttpError(400, 'Elegí un producto válido para cotizar.');
  if (product.status === 'archivado') throw new HttpError(400, 'Ese producto está archivado.');

  const hasItems = Array.isArray(body.items) && body.items.length > 0;
  let totals;
  let normalizedItems = null;
  if (hasItems) {
    normalizedItems = body.items.slice(0, 40).map((item) => {
      const itemProduct = store.find('products', asString(item.productId)) || product;
      const unitPrice = item.unitPrice === undefined ? Number(itemProduct.price || 0) : asNumber(item.unitPrice);
      if (!(unitPrice > 0)) throw new HttpError(400, `Precio inválido para ${itemProduct.name || 'una pieza'}.`);
      return {
        productId: itemProduct.id,
        productName: itemProduct.name,
        code: itemProduct.code || '',
        quantity: asNumber(item.quantity, 1),
        unitPrice,
        discount: asNumber(item.discount, 0),
      };
    });
    totals = quoteTotalsMulti({ items: normalizedItems, shipping: body.shipping, taxRate: body.taxRate });
  } else {
    const unitPrice = body.unitPrice === undefined ? Number(product.price || 0) : asNumber(body.unitPrice);
    if (!(unitPrice > 0)) throw new HttpError(400, 'El producto necesita un precio mayor a cero para cotizar.');
    totals = quoteTotals({
      quantity: body.quantity,
      unitPrice,
      shipping: body.shipping,
      discount: body.discount,
      taxRate: body.taxRate,
    });
  }
  const validDays = body.validDays === undefined
    ? Number(settings.sales?.quoteValidityDays || 15)
    : asNumber(body.validDays, 15);
  const currency = asString(body.currency, product.currency || settings.brand?.currency || 'USD').toUpperCase().slice(0, 6);
  const paymentLink = validatePaymentLink(
    body.paymentLink ?? product.paymentLink ?? settings.sales?.paymentLink ?? '',
  );
  const now = nowISO();
  const quote = {
    id: uid('qte'),
    number: await nextQuoteNumber(),
    productId: product.id,
    productName: hasItems ? `${totals.items.length} piezas` : product.name,
    items: normalizedItems,
    currency,
    language: quoteLanguage(thread),
    ...totals,
    validUntil: validUntilDate(validDays),
    paymentLink,
    payTerms: asString(body.payTerms).slice(0, 500),
    volumeNote: asString(body.volumeNote).slice(0, 500),
    shipNote: asString(body.shipNote).slice(0, 500),
    notes: asString(body.notes).slice(0, 2000),
    status: 'borrador',
    createdAt: now,
    updatedAt: now,
  };
  const built = buildQuote({ thread, product, brand: settings.brand, quote });
  quote.subject = built.subject;
  const draft = {
    id: uid('drf'),
    channel: 'email',
    language: built.language,
    subject: built.subject,
    body: built.text,
    status: body.approve === true ? 'listo' : 'revisar',
    source: 'cotizacion',
    quoteId: quote.id,
    guardVersion: 2,
    createdAt: now,
    reviewNote: body.approve === true
      ? undefined
      : 'Cotización generada automáticamente. Revisá precio, envío y plazo antes de enviarla.',
  };
  quote.draftId = draft.id;
  thread.quotes = [quote, ...(thread.quotes || [])];
  thread.drafts = [draft, ...(thread.drafts || [])];
  if (['nuevo', 'contactado', 'respondio', 'interesado'].includes(thread.stage)) thread.stage = 'negociando';
  thread.nextStep = `Revisar y enviar la cotización ${quote.number}.`;
  thread.updatedAt = now;
  await store.set('threads', threads);
  await store.activity('outreach', `Cotización ${quote.number} preparada para ${thread.contact?.company || thread.contact?.email || 'el contacto'}: ${hasItems ? `${totals.items.length} piezas` : `${totals.quantity} × ${product.name}`}.`, { threadId: thread.id, quoteId: quote.id });
  return { quote, draft, thread };
}

async function setQuoteStatus(threadId, quoteId, status) {
  if (!['borrador', 'enviada', 'aceptada', 'rechazada'].includes(status)) {
    throw new HttpError(400, 'Estado de cotización inválido.');
  }
  const threads = store.get('threads');
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
  const quote = (thread.quotes || []).find((item) => item.id === quoteId);
  if (!quote) throw new HttpError(404, 'Cotización no encontrada.');
  const now = nowISO();
  quote.status = status;
  quote.updatedAt = now;
  if (status === 'enviada' && !quote.sentAt) quote.sentAt = now;
  if (status === 'aceptada') {
    quote.acceptedAt = now;
    // Si la venta se cerró antes de enviar la cotización, ese borrador ya no
    // debe poder salir: el pedido quedó confirmado por otra vía.
    for (const draft of thread.drafts || []) {
      if (draft.quoteId !== quote.id || !['listo', 'revisar'].includes(draft.status)) continue;
      draft.status = 'descartado';
      draft.discardedAt = now;
      draft.discardReason = 'La cotización fue aceptada: el borrador ya no hace falta.';
    }
    await markThreadWon(thread);
    thread.nextStep = `Venta cerrada con la cotización ${quote.number}. Preparar producción y postventa.`;
  } else if (status === 'rechazada') {
    quote.rejectedAt = now;
    if (thread.stage === 'negociando') thread.stage = 'respondio';
    thread.nextStep = `Cotización ${quote.number} rechazada. Entender el motivo y ofrecer alternativa.`;
  }
  thread.updatedAt = now;
  await store.set('threads', threads);
  await store.activity('outreach', `Cotización ${quote.number}: ${status}.`, { threadId: thread.id, quoteId: quote.id });
  return { quote, thread };
}

async function sendThreadMessage(threadId, body) {
  const threads = store.get('threads');
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
  const drafts = thread.drafts || [];
  let draft;
  if (body.draftId) {
    draft = drafts.find((d) => d.id === body.draftId);
    if (!draft) throw new HttpError(404, 'Borrador no encontrado. Recargá la conversación antes de enviar.');
  } else {
    draft = drafts.find((d) => d.status === 'listo');
  }
  if (!draft) throw new HttpError(400, 'No hay un borrador listo para enviar. Aprobá uno o escribilo a mano.');
  if (draft.status === 'bloqueado') {
    throw new HttpError(400, draft.blockedReason || 'Ese borrador está bloqueado por cumplimiento o red team. No se puede enviar.');
  }
  if (draft.status === 'revisar') {
    throw new HttpError(400, 'Ese borrador está en revisión. Editalo y marcalo como aprobado antes de enviarlo.');
  }
  if (draft.status !== 'listo') throw new HttpError(400, 'Ese borrador ya fue enviado o descartado.');

  const settings = store.settings();
  const channel = ['resend', 'webhook', 'gmail', 'manual'].includes(body.channel) ? body.channel : 'manual';
  if (body.automated === true && !hasDocumentedOptIn(thread.contact)) {
    throw new HttpError(400, 'El piloto automático exige consentimiento documentado del destinatario.');
  }
  const company = thread.contact?.company || '';
  let message;
  try {
    message = composeEmail(thread, draft, settings);
  } catch (error) {
    throw new HttpError(400, error.message || 'No se pudo preparar el mensaje.');
  }

  // Hilo de correo: se guarda el Message-ID propio y se responde al último
  // mensaje entrante. Sin esto, el webhook no puede saber a qué producto
  // pertenece una respuesta cuando el comprador tiene varios hilos abiertos.
  const previousInbound = lastInboundMessage(thread);
  if (channel === 'resend' && !hasDocumentedOptIn(thread.contact)) {
    throw new HttpError(400, 'Resend exige consentimiento explícito documentado. Editá el contacto y registrá la evidencia antes de enviar.');
  }
  if (channel === 'resend') {
    message.idempotencyKey = resendIdempotencyKey(thread.id, draft.id);
    message.consentVerified = true;
    message.messageId = `<lucian-${message.idempotencyKey.slice(7, 39)}@${messageIdDomain(settings)}>`;
  } else {
    message.messageId = newMessageId(settings);
  }
  message.inReplyTo = previousInbound?.messageId || '';
  message.references = [previousInbound?.references, previousInbound?.messageId]
    .filter(Boolean)
    .join(' ')
    .trim();

  try {
    assertCanSend(settings, threads, message.to, threadSuppressions(thread), {
      manual: channel === 'manual',
      company,
    });
  } catch (error) {
    throw new HttpError(400, error.message || 'No se puede enviar este mensaje.');
  }

  let delivery = null;
  if (channel === 'manual') {
    if (body.confirm !== true) throw new HttpError(400, 'Para marcar un mensaje como enviado necesitás confirmarlo.');
  } else {
    if (channel === 'resend') {
      try { delivery = await sendWithResend(settings, message); } catch (error) { throw new HttpError(502, error.message || 'Resend rechazó el envío.'); }
    }
    if (channel === 'gmail') {
      try { delivery = await sendWithGmail(settings, message); } catch (error) { throw new HttpError(502, error.message || 'Gmail rechazó el envío.'); }
    }
    if (channel === 'webhook') {
      try { delivery = await sendWithWebhook(settings, message, { threadId: thread.id, contact: thread.contact }); } catch (error) { throw new HttpError(502, error.message || 'El webhook rechazó el envío.'); }
    }
  }

  const now = nowISO();
  const sent = {
    id: uid('msg'),
    direction: 'out',
    channel: channel === 'manual'
      ? (['email', 'formulario', 'whatsapp', 'otro'].includes(draft.channel) ? draft.channel : 'otro')
      : channel,
    subject: message.subject,
    body: message.text,
    at: now,
    status: channel === 'manual' ? 'enviado_manual' : 'enviado',
    provider: channel,
    messageId: message.messageId,
    ...(message.inReplyTo ? { inReplyTo: message.inReplyTo } : {}),
    ...(message.references ? { references: message.references } : {}),
    ...(delivery?.id ? { providerId: delivery.id } : {}),
  };
  thread.messages = [...(thread.messages || []), sent];
  draft.status = 'enviado';
  draft.sentAt = now;
  draft.sentChannel = channel;
  if (draft.quoteId) {
    const quote = (thread.quotes || []).find((item) => item.id === draft.quoteId);
    if (quote && quote.status === 'borrador') {
      quote.status = 'enviada';
      quote.sentAt = now;
      quote.sentMessageId = sent.id;
    }
  }
  if (thread.stage === 'nuevo') thread.stage = 'contactado';
  thread.lastActivityAt = now;
  thread.updatedAt = now;
  if (draft.source === 'seguimiento') {
    // Un seguimiento cuenta una sola vez y agenda el siguiente paso.
    // El paso 3 cierra la secuencia: no se vuelve a escribir.
    thread.followUpCount = Number(thread.followUpCount || 0) + 1;
    thread.nextStep = thread.followUpCount >= 2 ? 'Secuencia cerrada; esperar respuesta.' : 'Siguiente seguimiento en 6 días.';
    thread.nextFollowUp = thread.followUpCount >= 2 ? null : new Date(Date.now() + 6 * 86400000).toISOString();
  } else if (draft.source === 'postventa') {
    // Un toque de postventa cuenta y NO agenda un seguimiento frío para
    // un cliente que ya compró: la relación la sigue la postventa.
    thread.postSaleCount = Number(thread.postSaleCount || 0) + 1;
    thread.postSaleAt = thread.postSaleAt || now;
    thread.nextFollowUp = null;
    thread.nextStep = thread.postSaleCount >= 3 ? 'Postventa cerrada; reorden solo si escriben.' : 'Próximo toque de postventa según calendario.';
  } else {
    thread.nextStep = 'Seguimiento con valor en 4 días.';
    thread.nextFollowUp = new Date(Date.now() + 4 * 86400000).toISOString();
  }
  await store.set('threads', threads);
  await store.activity('outreach', `Mensaje ${channel === 'manual' ? 'marcado como enviado' : 'enviado'} a ${thread.contact?.company || message.to || 'el contacto'}.`, { threadId, channel });
  return { thread, message: sent, draft };
}

function normalizeSubject(value) {
  return String(value || '')
    .replace(/^(?:(?:re|fwd?|rv|aw|tr|enc)\s*:\s*)+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function threadSortKey(thread) {
  return Date.parse(thread?.lastActivityAt || thread?.updatedAt || thread?.createdAt || 0) || 0;
}

/* Enrutamiento de respuestas. Un comprador puede tener un hilo por producto:
   elegir el primero por email manda la respuesta al producto equivocado y
   reinicia el seguimiento de una conversación que estaba avanzando.
   Prioridad: Message-ID citado > asunto del último saliente > actividad. */
function findThreadForEmail(email, inbound = null) {
  const target = normalizeEmail(email);
  if (!target) return null;
  const threads = store.get('threads');

  if (inbound) {
    const refs = new Set([
      ...(Array.isArray(inbound.references) ? inbound.references : []),
      ...(inbound.inReplyTo ? [inbound.inReplyTo] : []),
    ].map((item) => String(item || '').trim()).filter(Boolean));
    if (refs.size) {
      const exact = threads.find((thread) => (thread.messages || []).some((message) => (
        message.direction === 'out' && message.messageId && refs.has(message.messageId)
      )));
      if (exact) return exact;
    }

    const subject = normalizeSubject(inbound.subject);
    if (subject) {
      const bySubject = threads
        .filter((thread) => normalizeEmail(thread.contact?.email) === target)
        .filter((thread) => (thread.messages || []).some((message) => (
          message.direction === 'out' && normalizeSubject(message.subject) === subject
        )))
        .sort((a, b) => threadSortKey(b) - threadSortKey(a));
      if (bySubject.length) return bySubject[0];
    }
  }

  return threads
    .filter((thread) => normalizeEmail(thread.contact?.email) === target)
    .sort((a, b) => threadSortKey(b) - threadSortKey(a))[0] || null;
}

async function createInboundThread(inbound, email) {
  const settings = store.settings();
  const latestMission = store.get('missions').find((m) => m.productId);
  const product = store.find('products', latestMission?.productId) || store.get('products')[0];
  const domain = email.split('@')[1] || '';
  const company = domain.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Contacto entrante';
  const nameMatch = String(inbound.from).match(/^\s*"?([^"<]+)"?\s*</);
  const now = nowISO();
  const thread = {
    id: uid('thr'),
    demo: false,
    missionId: latestMission?.id || null,
    productId: product?.id || null,
    contact: {
      name: nameMatch ? nameMatch[1].trim() : 'Contacto',
      company,
      role: '',
      email,
      emailStatus: 'publico',
      country: '',
      city: '',
      website: '',
      type: 'tienda',
    },
    stage: 'respondio',
    score: 55,
    source: 'Respuesta entrante',
    notes: 'Hilo creado automáticamente desde el webhook de correo.',
    drafts: [],
    messages: [],
    nextStep: 'Leer la respuesta y decidir el siguiente paso.',
    nextFollowUp: null,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
  store.get('threads').unshift(thread);
  await store.set('threads', store.get('threads'));
  await store.activity('reply', `Respuesta entrante de ${email} sin hilo previo.`, { threadId: thread.id });
  return thread;
}

/* Procesa eventos de entrega del proveedor (rebotes, quejas, aperturas).
   Un rebote duro o una queja de spam suprimen la dirección de inmediato: la
   reputación del dominio es el activo más frágil de todo el sistema. */
async function handleEmailEvent(event) {
  if (!event?.emails?.length) return { touched: 0, suppressed: 0 };
  const now = nowISO();
  const threads = store.get('threads');
  let touched = 0;
  let suppressed = 0;

  for (const email of event.emails) {
    const related = threads
      .filter((thread) => normalizeEmail(thread.contact?.email) === email)
      .sort((a, b) => threadSortKey(b) - threadSortKey(a));
    const thread = related[0] || null;

    if (thread) {
      const outbound = [...(thread.messages || [])].reverse().find((message) => (
        message.direction === 'out'
        && (
          (event.messageId && (message.messageId === event.messageId || message.providerId === event.messageId))
          || message.status === 'enviado'
        )
      ));
      if (outbound) {
        if (event.kind === 'delivered') {
          outbound.status = 'entregado';
          outbound.deliveredAt = now;
        } else if (event.kind === 'opened') {
          outbound.openedAt = now;
        } else if (event.kind === 'clicked') {
          outbound.clickedAt = now;
        } else if (event.kind === 'delayed') {
          outbound.deliveryDelayedAt = now;
        } else if (event.kind === 'bounce') {
          outbound.status = event.hard ? 'rebotado' : 'rebote_temporal';
          outbound.bouncedAt = now;
        } else if (event.kind === 'complaint') {
          outbound.status = 'queja';
          outbound.complainedAt = now;
        }
        if (event.reason) outbound.deliveryReason = event.reason;
      }
      thread.lastActivityAt = now;
      thread.updatedAt = now;
      touched += 1;
    }

    const mustSuppress = event.kind === 'complaint' || (event.kind === 'bounce' && event.hard);
    if (!mustSuppress) continue;

    const reason = event.kind === 'complaint'
      ? 'Marcó el correo como spam (queja del proveedor).'
      : `Rebote definitivo: ${event.reason || 'el servidor rechazó la dirección'}.`;
    await addSuppression({ email, reason }, {
      source: event.kind === 'complaint' ? 'queja de spam' : 'rebote',
      demo: thread?.demo,
    });
    suppressed += 1;

    if (!thread) continue;
    thread.stage = 'perdido';
    thread.nextFollowUp = null;
    thread.nextStep = event.kind === 'complaint'
      ? 'Marcó el correo como spam. No volver a contactar.'
      : 'La dirección rebotó. Corregí el email antes de reintentar.';
    thread.contact = { ...(thread.contact || {}), emailStatus: event.kind === 'complaint' ? 'queja' : 'rebotado' };
    if (event.kind === 'bounce') thread.emailBouncedAt = now;
    if (event.kind === 'complaint') thread.emailComplainedAt = now;
    for (const draft of thread.drafts || []) {
      if (!['listo', 'revisar'].includes(draft.status)) continue;
      draft.status = 'bloqueado';
      draft.blockedReason = event.kind === 'complaint'
        ? 'El contacto marcó el correo como spam.'
        : 'El correo rebotó: la dirección no es entregable.';
    }
    for (const item of outbox.items()) {
      if (item.status !== 'pending' || item.threadId !== thread.id) continue;
      item.status = 'cancelled';
      item.error = event.kind === 'complaint' ? 'El contacto marcó el correo como spam.' : 'El correo rebotó.';
    }
  }

  if (touched) await store.set('threads', threads);
  if (suppressed) await outbox.save();
  if (touched || suppressed) {
    await store.activity(
      'system',
      `Evento de correo ${event.kind}: ${touched} hilo(s) actualizado(s), ${suppressed} dirección(es) suprimida(s).`,
      {},
    );
  }
  return { touched, suppressed };
}

/* ─────────────────────────────────────────────────────────────
   Lista de "no contactar" (opt-out)
   ───────────────────────────────────────────────────────────── */

async function addSuppression(input = {}, options = {}) {
  if (!input || typeof input !== 'object') input = {};
  const email = normalizeEmail(input.email);
  const company = asString(input.company).trim().slice(0, 200);
  const blockDomain = input.blockDomain === true || input.blockDomain === 'true';
  let domain = String(input.domain || '').trim().toLowerCase();
  // Un email bloquea esa dirección. El dominio solo se bloquea si el dueño
  // lo pidió explícitamente (o cargó un dominio): así no se bloquea toda
  // una empresa sin querer.
  if (!domain && email && blockDomain) domain = emailDomain(email);
  if (!email && !domain && !company) {
    throw new HttpError(400, 'Indicá al menos un email, un dominio o una empresa.');
  }
  if (email && !isValidEmail(email)) throw new HttpError(400, 'El email de la lista de no contactar no es válido.');
  if (domain && isSharedEmailDomain(domain)) {
    if (!email) throw new HttpError(400, 'No se puede bloquear un dominio compartido como Gmail. Agregá el email exacto.');
    domain = '';
  }

  const list = store.get('suppressions');
  const companyKey = normalizeCompany(company);
  const existing = list.find((item) => {
    if (email && normalizeEmail(item.email) === email) return true;
    if (domain && String(item.domain || '').toLowerCase() === domain) return true;
    if (!email && !domain && companyKey && normalizeCompany(item.company) === companyKey) return true;
    return false;
  });
  if (existing) {
    if (company && !existing.company) existing.company = company;
    if (domain && !existing.domain) existing.domain = domain;
    if (input.reason) existing.reason = asString(input.reason).slice(0, 500);
    existing.updatedAt = nowISO();
    await store.set('suppressions', list);
    return existing;
  }

  const item = {
    id: uid('sup'),
    demo: Boolean(options.demo),
    email,
    domain,
    company,
    reason: asString(input.reason, 'Pidió no recibir más mensajes.').slice(0, 500),
    source: asString(options.source, 'manual'),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  list.unshift(item);
  await store.set('suppressions', list);
  await store.activity('system', `No contactar: ${email || domain || company}.`, { suppressionId: item.id });
  return item;
}

async function registerOptOut(thread, text, source = 'respuesta') {
  if (!thread) return null;
  const signal = detectOptOut(text);
  if (!signal) return null;
  const email = normalizeEmail(thread.contact?.email);
  const suppression = await addSuppression({
    email: email || '',
    // El opt-out es de la persona. Solo se bloquea la empresa cuando no hay
    // email (contacto por formulario/LinkedIn).
    company: email ? '' : (thread.contact?.company || ''),
    reason: `Respondió pidiendo no recibir más mensajes (${signal.rule}: “${String(signal.phrase).slice(0, 90)}”).`,
  }, { source, demo: thread.demo });
  const at = nowISO();
  thread.stage = 'perdido';
  thread.nextStep = 'Pidió no recibir más mensajes. No volver a contactar.';
  thread.nextFollowUp = null;
  thread.optedOutAt = at;
  thread.optOut = {
    at,
    phrase: String(signal.phrase).slice(0, 200),
    rule: signal.rule,
    source,
    suppressionId: suppression.id,
  };
  thread.updatedAt = at;
  // No se mutan los borradores: la supresión se aplica al enviar/descargar.
  // Así, si fue un falso positivo, retirar la supresión deja todo como estaba.
  await store.set('threads', store.get('threads'));
  await store.activity('reply', `${thread.contact?.company || thread.contact?.email || 'Contacto'} pidió no recibir más mensajes (${signal.rule}).`, { threadId: thread.id, suppressionId: suppression.id });
  return suppression;
}

/* Al retirar una supresión, los borradores que habían quedado bloqueados por
   opt-out vuelven a revisión (nunca directo a "listo": la persona decide). */
async function releaseSuppression(item) {
  if (!item) return { released: 0 };
  const threads = store.get('threads');
  const itemEmail = normalizeEmail(item.email);
  const itemDomain = String(item.domain || '').toLowerCase();
  const itemCompany = normalizeCompany(item.company);
  let released = 0;
  let changed = false;
  for (const thread of threads) {
    if (item.demo === true && !thread.demo) continue;
    const email = normalizeEmail(thread.contact?.email);
    const domain = emailDomain(email);
    const company = normalizeCompany(thread.contact?.company);
    const matches = (
      (itemEmail && email === itemEmail)
      || (itemDomain && !isSharedEmailDomain(itemDomain) && domain === itemDomain)
      || (itemCompany && company === itemCompany)
    );
    if (!matches) continue;
    let threadChanged = false;
    for (const draft of thread.drafts || []) {
      if (draft.status === 'bloqueado' && /opt-?out|pidi[oó] no recibir/i.test(draft.blockedReason || '')) {
        draft.status = 'revisar';
        draft.reviewNote = 'La supresión se retiró. Revisá el borrador antes de volver a contactar.';
        draft.blockedReason = undefined;
        released += 1;
        threadChanged = true;
      }
    }
    if (thread.optOut) {
      delete thread.optOut;
      delete thread.optedOutAt;
      if (thread.stage === 'perdido') thread.stage = 'respondio';
      thread.nextStep = 'La supresión se retiró. Revisá la conversación antes de volver a contactar.';
      thread.nextFollowUp = null;
      threadChanged = true;
    }
    if (threadChanged) {
      thread.updatedAt = nowISO();
      changed = true;
    }
  }
  if (changed) await store.set('threads', threads);
  return { released };
}

/* ─────────────────────────────────────────────────────────────
   Copias de seguridad
   ───────────────────────────────────────────────────────────── */

async function walkFiles(dir, base = dir) {
  const out = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walkFiles(full, base));
    else if (entry.isFile()) out.push({ full, rel: path.relative(base, full).replace(/\\/g, '/') });
  }
  return out;
}

async function makeBackup({ safe = false } = {}) {
  const bundle = store.exportBundle();
  if (safe && bundle?.data?.settings) {
    for (const path of SECRET_PATHS) {
      // borrar la clave del bundle
      const parts = path.split('.');
      let cursor = bundle.data.settings;
      for (let i = 0; i < parts.length - 1; i += 1) {
        if (!cursor || typeof cursor !== 'object') { cursor = null; break; }
        cursor = cursor[parts[i]];
      }
      if (cursor && typeof cursor === 'object') cursor[parts.at(-1)] = '';
    }
  }
  const entries = [
    { name: 'lucian-data.json', data: Buffer.from(JSON.stringify(bundle, null, 2), 'utf8') },
    {
      name: 'LEEME-BACKUP.txt',
      data: Buffer.from(`Copia de seguridad de Lucian${safe ? ' (sin claves)' : ''}\nFecha: ${nowISO()}\n\n${safe ? 'No incluye claves de API: cargalas de nuevo al restaurar.' : 'Incluye datos y fotos. Contiene claves de API en texto plano: guardala en un lugar privado.'}\nPara restaurar: Ajustes → Datos → Restaurar copia.\n`, 'utf8'),
    },
  ];
  const files = await walkFiles(store.mediaDir);
  for (const file of files) {
    entries.push({ name: `media/${file.rel}`, data: await fsp.readFile(file.full) });
  }
  return createZip(entries);
}

async function restoreBackup(buffer) {
  if (store.get('missions').some((m) => ['running', 'queued'].includes(m.status))) {
    throw new HttpError(409, 'Hay una misión en curso. Esperá a que termine antes de restaurar.');
  }
  let bundle = null;
  if (buffer.slice(0, 2).toString('ascii') === 'PK') {
    const entries = readZip(buffer);
    const dataEntry = entries.find((e) => e.name === 'lucian-data.json');
    if (!dataEntry) throw new HttpError(400, 'La copia no contiene lucian-data.json.');
    bundle = JSON.parse(dataEntry.data.toString('utf8'));
    for (const entry of entries) {
      if (!entry.name.startsWith('media/')) continue;
      const rel = entry.name.slice('media/'.length);
      if (!rel || rel.includes('..')) continue;
      const target = store.mediaPath(rel);
      if (!target) continue;
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, entry.data);
    }
  } else {
    bundle = JSON.parse(buffer.toString('utf8'));
  }
  await store.importBundle(bundle);
  const migrated = await migrateLegacyDrafts(store);
  const sanitized = await sanitizeLegacyThreads(store);
  notifier.refresh();
  return {
    products: store.get('products').length,
    missions: store.get('missions').length,
    threads: store.get('threads').length,
    migratedDrafts: migrated.changed,
    unverifiedThreads: sanitized.changed,
  };
}

/* ─────────────────────────────────────────────────────────────
   Pruebas de integración
   ───────────────────────────────────────────────────────────── */

async function runIntegrationTest(target) {
  const settings = store.settings();
  if (target === 'ai') {
    const result = await testAI(settings);
    return { modelo: result.model, proveedor: result.provider, respuesta: result.reply };
  }
  if (target === 'search') {
    const detail = await searchWebDetailed(settings, 'tiendas de iluminación de diseño Madrid', { count: 5 });
    if (!detail.results.length) {
      const reason = detail.errors?.[0] || 'La búsqueda no devolvió resultados.';
      throw new Error(reason);
    }
    return {
      proveedor: searchProviderInfo(settings).label,
      motor: detail.engine,
      resultados: detail.results.length,
      muestra: detail.results.slice(0, 3).map((r) => ({ titulo: r.title, url: r.url })),
      errores: (detail.errors || []).slice(0, 3),
    };
  }
  if (target === 'telegram') return testTelegram(settings);
  if (target === 'whatsapp') return testWhatsApp(settings);
  if (target === 'resend') return testResend(settings);
  if (target === 'hunter') {
    if (!settings.hunter?.apiKey) throw new Error('Falta la clave de Hunter.');
    const account = await hunterAccount(settings.hunter.apiKey);
    return { email: account.email || '', plan: account.plan_name || account.plan || '', credito: account.credits ?? null };
  }
  if (target === 'email') {
    const from = settings.email?.from || '';
    if (!from) throw new Error('Falta configurar el remitente.');
    return { remitente: from, proveedor: settings.email.provider, limite: dailyLimitInfo(settings, store.get('threads')) };
  }
  throw new HttpError(400, 'Prueba desconocida.');
}

/* ─────────────────────────────────────────────────────────────
   Archivos estáticos
   ───────────────────────────────────────────────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function setCommonHeaders(res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'same-origin');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
}

async function serveFile(req, res, file, { cache = 'no-store', svg = false } = {}) {
  let stat;
  try { stat = await fsp.stat(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  res.setHeader('content-type', MIME[ext] || 'application/octet-stream');
  res.setHeader('content-length', stat.size);
  res.setHeader('cache-control', cache);
  setCommonHeaders(res);
  if (svg) res.setHeader('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  res.setHeader('last-modified', stat.mtime.toUTCString());
  if (req.method === 'HEAD') { res.writeHead(200); res.end(); return true; }
  res.writeHead(200);
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.pipe(res);
  }).catch(() => { try { res.destroy(); } catch { /* noop */ } });
  return true;
}

async function serveStatic(req, res, pathname) {
  if (pathname.startsWith('/media/')) {
    const rel = decodeURIComponent(pathname.slice('/media/'.length));
    const file = store.mediaPath(rel);
    if (!file) { fail(res, 404, 'Archivo no encontrado.'); return; }
    const ok = await serveFile(req, res, file, { cache: 'public, max-age=3600', svg: file.toLowerCase().endsWith('.svg') });
    if (!ok) fail(res, 404, 'Archivo no encontrado.');
    return;
  }

  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const candidate = path.resolve(PUBLIC_DIR, relative);
  if (!candidate.startsWith(path.resolve(PUBLIC_DIR))) { fail(res, 403, 'Acceso denegado.'); return; }

  if (await serveFile(req, res, candidate, { cache: relative === 'index.html' ? 'no-store' : 'no-cache' })) return;
  if (!path.extname(relative)) {
    if (await serveFile(req, res, path.join(PUBLIC_DIR, 'index.html'), { cache: 'no-store' })) return;
  }
  fail(res, 404, 'No encontrado.');
}

/* ─────────────────────────────────────────────────────────────
   Router
   ───────────────────────────────────────────────────────────── */

async function handle(req, res) {
  // Protección contra DNS rebinding: solo se aceptan Host locales.
  const requestPath = String(req.url || '').split('?')[0];
  const isWebhook = requestPath.startsWith('/api/webhooks/');
  const hostHeader = String(req.headers.host || '').trim();
  const hostName = hostHeader.split(':')[0].toLowerCase().replace(/^\[|\]$/g, '');
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1']);
  // En modo compartir (LUCIAN_HOST=0.0.0.0) se permiten también las IPs
  // de la red local para que otra PC pueda abrir la interfaz.
  const lanMode = HOST === '0.0.0.0' || HOST === '::';
  const isLanHost = lanMode && /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostName);
  // Un túnel aporta HTTPS, pero NO autentica al visitante.
  const isTunnelHost = /\.trycloudflare\.com$/.test(hostName) || /\.ngrok(-free)?\.app$/.test(hostName);
  const publicHost = String(process.env.LUCIAN_PUBLIC_HOST || '').trim().toLowerCase().split(':')[0];
  const isNamedPublicHost = Boolean(publicHost && hostName === publicHost);
  if (!isWebhook && (!hostName || (!allowedHosts.has(hostName) && !isLanHost && !isTunnelHost && !isNamedPublicHost))) {
    res.writeHead(403, { 'content-type': 'text/plain' });
    res.end('Host no permitido.');
    return;
  }
  setCommonHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

  // ── Autenticación obligatoria en modo red/túnel ───────────────
  // En local (loopback) no se pide nada. Cuando se comparte por red
  // o túnel, todas las rutas /api/* (excepto webhooks y /login)
  // exigen la clave que se muestra al arrancar. Sin esto, cualquiera
  // con la URL podría leer secretos o borrar datos.
  // Host es controlado por el cliente: nunca basta para determinar localhost.
  // Cloudflare y otros proxies pueden usar un socket loopback; sus cabeceras
  // forwarded y su dominio público deben obligar a autenticarse.
  const peer = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const isLoopbackPeer = peer === '127.0.0.1' || peer === '::1';
  const isLocalHost = allowedHosts.has(hostName) && isLoopbackPeer
    && !req.headers['x-forwarded-for'] && !req.headers['x-forwarded-host'];
  const needsAuth = !isLocalHost && !isWebhook && pathname.startsWith('/api/') && pathname !== '/api/login';
  if (needsAuth) {
    const provided = req.headers['x-lucian-access']
      || (String(req.headers.cookie || '').match(/(?:^|;\s*)lucian_access=([^;]+)/) || [])[1]
      || '';
    if (!webhookTokenMatches(provided, ACCESS_TOKEN)) {
      fail(res, 401, 'Se requiere clave de acceso. Pegala en la pantalla de Lucian.');
      return;
    }
  }

  if (pathname === '/api/login' && method === 'POST') {
    if (!originAllowed(req)) { fail(res, 403, 'Origen no permitido.'); return; }
    const body = await readJson(req).catch(() => ({}));
    const provided = String(body.token || '');
    if (webhookTokenMatches(provided, ACCESS_TOKEN)) {
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': `lucian_access=${ACCESS_TOKEN}; HttpOnly; SameSite=Strict; Path=/${isTunnelHost || isNamedPublicHost || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https' ? '; Secure' : ''}`,
      });
      res.end(JSON.stringify({ ok: true }));
    } else {
      fail(res, 401, 'Clave incorrecta.');
    }
    return;
  }

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  if (!originAllowed(req)) { fail(res, 403, 'Origen no permitido.'); return; }

  if (!pathname.startsWith('/api/')) {
    await serveStatic(req, res, pathname);
    return;
  }

  if (pathname === '/api/connections' && method === 'GET') {
    json(res, 200, await diagnoseConnections(store.settings(), store));
    return;
  }

  if (pathname === '/api/connections/test' && method === 'POST') {
    const body = await readJson(req);
    const id = String(body?.id || '');
    const result = await testConnection(id, store.settings());
    json(res, 200, result);
    return;
  }

  if (pathname === '/api/autopilot' && method === 'GET') {
    json(res, 200, getAutopilotState());
    return;
  }

  if (pathname === '/api/autopilot/run' && method === 'POST') {
    json(res, 200, await runAutopilot(store, notifier, (line) => console.log(line), autopilotDeps));
    return;
  }

  if (pathname === '/api/connections/failover/reset' && method === 'POST') {
    resetAiFailover();
    json(res, 200, { ok: true, state: getAiFailoverState() });
    return;
  }

  if (pathname === '/api/health' && method === 'GET') {
    json(res, 200, {
      ok: true,
      app: 'lucian',
      version: VERSION,
      ai: isAIReady(store.settings()),
      demo: settingsFlags(store.settings()).demo,
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  if (pathname === '/api/state' && method === 'GET') {
    json(res, 200, statePayload());
    return;
  }

  if (pathname === '/api/email/check-inbox' && method === 'POST') {
    const settings = store.settings();
    const email = settings.email || {};
    if (email.provider !== 'gmail' || !email.smtpUser || !email.smtpPassword) {
      throw new HttpError(400, 'Configurá Gmail en Ajustes → Correo para leer la bandeja de entrada.');
    }
    await pollGmailInbox();
    json(res, 200, { ok: true, message: 'Bandeja revisada.' });
    return;
  }

  if (pathname === '/api/outbox' && method === 'GET') {
    json(res, 200, { ...outbox.status(), items: outbox.items().slice(0, 60) });
    return;
  }

  if (pathname === '/api/outbox/enqueue-ready' && method === 'POST') {
    const result = await outbox.enqueueAllReady();
    outbox.tick().catch(() => {});
    json(res, 200, { ok: true, ...result, outbox: outbox.status() });
    return;
  }

  const outboxCancel = pathname.match(/^\/api\/outbox\/([^/]+)\/cancel$/);
  if (outboxCancel && method === 'POST') {
    const ok = await outbox.cancel(decodeURIComponent(outboxCancel[1]));
    json(res, ok ? 200 : 404, { ok, outbox: outbox.status() });
    return;
  }

  if (pathname === '/api/settings' && method === 'PUT') {
    const body = await readJson(req);
    const prevToken = store.settings()?.notify?.telegram?.token;
    const settings = await store.saveSettings(body);
    if (body?.notify?.telegram?.token && body.notify.telegram.token !== prevToken) {
      await store.setMeta({ telegramOffset: 0 });
    }
    notifier.refresh();
    await store.activity('settings', 'Ajustes actualizados.');
    json(res, 200, { settings: maskSettings(settings), flags: settingsFlags(settings) });
    return;
  }

  if (pathname === '/api/settings/secret/clear' && method === 'POST') {
    const body = await readJson(req);
    await store.clearSecret(asString(body.path));
    json(res, 200, { settings: maskSettings(store.settings()), flags: settingsFlags(store.settings()) });
    return;
  }

  if (pathname === '/api/settings/ai-configure' && method === 'POST') {
    const body = await readJson(req);
    const settings = store.settings();
    if (!isAIReady(settings)) throw new HttpError(400, 'Configurá una IA primero en Ajustes → Inteligencia artificial.');
    const cfg = resolveAIConfig(settings);
    const goal = String(body?.goal || '').trim().slice(0, 500);
    const context = {
      brand: settings.brand,
      products: store.get('products').length,
      missions: store.get('missions').length,
      threads: store.get('threads').length,
      current: {
        ai: settings.ai?.provider,
        search: settings.search?.provider,
        email: settings.email?.provider,
        dailyLimit: settings.email?.dailyLimit,
        warmup: settings.email?.warmup,
        markets: settings.mission?.markets,
        depth: settings.mission?.depth,
        maxProspects: settings.mission?.maxProspects,
      },
    };
    const result = await generateJson(cfg, {
      system: 'Sos un asistente de configuracion de Lucian. Analiza la situacion actual del usuario (productos, misiones, conversaciones) y genera una configuracion personalizada. Devuelve un JSON con un parche de ajustes y un resumen. El parche solo puede tocar: mission (markets, depth, maxProspects, tone, currency, contactCooldownDays), email (dailyLimit, warmup, autopilotEnabled, autopilotSpacingMin, followUps, postSales), sales (paymentLink, quoteValidityDays), onboarding. No toques claves ni URLs de proveedores. Espanol rioplatense. Varia la respuesta segun el contexto: no repitas siempre la misma configuracion.',
      prompt: `El dueno quiere que configures Lucian. Pedido: "${goal || 'configuracion optima para empezar a vender lamparas de diseno'}".\nContexto actual: ${JSON.stringify(context)}.\nAnaliza el contexto y genera una configuracion personalizada. Devuelve: { "patch": { ... }, "summary": "que cambiaste y por que (max 4 frases)" }.`,
      temperature: 0.7,
      maxTokens: 4000,
      expects: 'object',
    });
    const data = asObject(result.data);
    const patch = isObject(data.patch) ? data.patch : {};
    // Sanitizar: solo campos permitidos.
    const allowed = new Set(['mission', 'email', 'sales', 'onboarding']);
    const safePatch = {};
    for (const key of Object.keys(patch)) {
      if (allowed.has(key) && isObject(patch[key])) safePatch[key] = patch[key];
    }
    const updated = await store.saveSettings(safePatch);
    await store.activity('settings', `Configuración asistida por IA: ${String(data.summary || 'aplicada').slice(0, 200)}`);
    json(res, 200, { settings: maskSettings(updated), flags: settingsFlags(updated), summary: data.summary || 'Configuración aplicada.', patch: safePatch });
    return;
  }

  if (pathname === '/api/settings/test' && method === 'POST') {
    const body = await readJson(req);
    try {
      const result = await runIntegrationTest(asString(body.target));
      json(res, 200, { ok: true, result });
    } catch (error) {
      json(res, 200, { ok: false, error: error.message });
    }
    return;
  }

  if (pathname === '/api/settings/telegram/chats' && method === 'POST') {
    const body = await readJson(req);
    const token = asString(body.token).trim() || store.settings().notify?.telegram?.token;
    const chats = await telegramChats(token);
    json(res, 200, { chats });
    return;
  }

  if (pathname === '/api/ai/models' && method === 'GET') {
    const cfg = resolveAIConfig(store.settings());
    const models = await listModels(cfg);
    json(res, 200, { models, provider: cfg.provider, current: cfg.model });
    return;
  }

  if (pathname === '/api/products' && method === 'GET') {
    json(res, 200, { products: store.get('products') });
    return;
  }

  if (pathname === '/api/products' && method === 'POST') {
    const body = await readJson(req);
    const product = await createProduct(body);
    json(res, 201, { product });
    return;
  }

  if (pathname === '/api/products/import' && method === 'POST') {
    const buffer = await readBody(req, 5 * 1024 * 1024);
    const result = await importProductsCsv(buffer.toString('utf8'));
    json(res, 201, result);
    return;
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch) {
    const id = decodeURIComponent(productMatch[1]);
    if (method === 'GET') {
      const product = store.find('products', id);
      if (!product) throw new HttpError(404, 'Producto no encontrado.');
      json(res, 200, { product });
      return;
    }
    if (method === 'PUT') {
      const body = await readJson(req);
      json(res, 200, { product: await updateProduct(id, body) });
      return;
    }
    if (method === 'DELETE') {
      const active = store.get('missions').some((m) => m.productId === id && ['running', 'queued'].includes(m.status));
      if (active) throw new HttpError(409, 'Ese producto tiene una misión en curso. Esperá a que termine.');
      const product = store.find('products', id);
      if (!product) throw new HttpError(404, 'Producto no encontrado.');
      for (const photo of product.photos || []) await store.removeMedia(photo.file);
      await store.set('products', store.get('products').filter((p) => p.id !== id));
      await store.activity('product', `Producto eliminado: ${product.name}.`, { productId: id });
      json(res, 200, { ok: true });
      return;
    }
  }

  if (pathname === '/api/missions' && method === 'GET') {
    json(res, 200, { missions: store.get('missions').map(missionSummary) });
    return;
  }

  if (pathname === '/api/missions' && method === 'POST') {
    const body = await readJson(req);
    const mission = await createMission(body);
    json(res, 201, { mission });
    return;
  }

  if (pathname === '/api/campaigns' && method === 'POST') {
    const body = await readJson(req);
    const campaign = await createCampaign(body);
    json(res, 201, { campaign });
    return;
  }

  if (pathname === '/api/missions/all' && method === 'DELETE') {
    const running = store.get('missions').filter((m) => ['running', 'queued'].includes(m.status));
    for (const m of running) {
      if (listeners.has(m.id)) {
        for (const res of listeners.get(m.id)) {
          try { res.end(); } catch { /* noop */ }
        }
        listeners.delete(m.id);
      }
    }
    const count = store.get('missions').length;
    await store.set('missions', []);
    await store.activity('mission', `Se borraron todas las misiones (${count}).`);
    json(res, 200, { ok: true, deleted: count });
    return;
  }

  const missionReconcile = pathname.match(/^\/api\/missions\/([^/]+)\/reconcile$/);
  if (missionReconcile && method === 'POST') {
    const id = decodeURIComponent(missionReconcile[1]);
    const mission = store.find('missions', id);
    if (!mission) throw new HttpError(404, 'Misión no encontrada.');
    if (['running', 'queued'].includes(mission.status)) throw new HttpError(409, 'La misión está en curso; esperá a que termine.');
    const product = store.find('products', mission.productId);
    if (!product) throw new HttpError(400, 'El producto de esta misión ya no existe.');
    const result = await reconcileThreads(mission, product, store.settings(), store);
    await store.activity('mission', `Borradores revalidados: ${mission.name}. ${result.updated} actualizados.`, { missionId: id });
    json(res, 200, { ok: true, ...result, mission: missionSummary(mission) });
    return;
  }

  const missionMatch = pathname.match(/^\/api\/missions\/([^/]+)$/);
  if (missionMatch) {
    const id = decodeURIComponent(missionMatch[1]);
    const mission = store.find('missions', id);
    if (method === 'GET') {
      if (!mission) throw new HttpError(404, 'Misión no encontrada.');
      const product = store.find('products', mission.productId);
      json(res, 200, {
        mission,
        product,
        threads: store.get('threads').filter((t) => t.missionId === id)
          .map((thread) => threadSummary(thread, store.get('suppressions'))),
        depthInfo: DEPTHS[mission.depth] || DEPTHS.estandar,
      });
      return;
    }
    if (method === 'DELETE') {
      if (!mission) throw new HttpError(404, 'Misión no encontrada.');
      if (['running', 'queued'].includes(mission.status)) throw new HttpError(409, 'No se puede borrar una misión en curso.');
      await store.set('missions', store.get('missions').filter((m) => m.id !== id));
      await store.activity('mission', `Misión eliminada: ${mission.name}.`, { missionId: id });
      json(res, 200, { ok: true });
      return;
    }
  }

  const missionAction = pathname.match(/^\/api\/missions\/([^/]+)\/(cancel|retry|events)$/);
  if (missionAction) {
    const id = decodeURIComponent(missionAction[1]);
    const action = missionAction[2];
    if (action === 'events' && method === 'GET') {
      const mission = store.find('missions', id);
      if (!mission) throw new HttpError(404, 'Misión no encontrada.');
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        'connection': 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      res.write(`data: ${JSON.stringify({ type: 'mission', mission, at: nowISO() })}\n\n`);
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(res);
      const heartbeat = setInterval(() => {
        try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
      }, 20000);
      heartbeat.unref?.();
      req.on('close', () => {
        clearInterval(heartbeat);
        listeners.get(id)?.delete(res);
      });
      return;
    }
    if (action === 'cancel' && method === 'POST') {
      const mission = store.find('missions', id);
      if (!mission) throw new HttpError(404, 'Misión no encontrada.');
      if (['done', 'done_with_warnings', 'error', 'cancelled'].includes(mission.status)) throw new HttpError(400, 'La misión ya terminó.');
      mission.cancelRequested = true;
      // Cancelación inmediata: no esperar a que el paso actual termine.
      // El worker ve cancelRequested y se detiene; mientras tanto la UI
      // muestra la misión como cancelada al instante.
      mission.status = 'cancelled';
      mission.finishedAt = mission.finishedAt || nowISO();
      mission.phase = 'cancelled';
      mission.currentStep = null;
      await store.set('missions', store.get('missions'));
      broadcast(id, { type: 'mission', mission, at: nowISO() });
      json(res, 200, { ok: true, mission: missionSummary(mission) });
      return;
    }
    if (action === 'retry' && method === 'POST') {
      const mission = await retryMission(id);
      json(res, 200, { ok: true, mission: missionSummary(mission) });
      return;
    }
  }

  if (pathname === '/api/threads' && method === 'POST') {
    const body = await readJson(req);
    const contact = isObject(body.contact) ? body.contact : {};
    const email = asString(contact.email).trim();
    if (!email || !isValidEmail(email)) throw new HttpError(400, 'El comprador necesita un email válido.');
    const now = nowISO();
    const thread = {
      id: uid('thr'),
      demo: false,
      missionId: null,
      productId: asString(body.productId) || null,
      contact: {
        company: asString(contact.company || contact.name, 'Cliente potencial'),
        name: asString(contact.name, ''),
        email,
        country: asString(contact.country, ''),
      },
      verification: null,
      unverified: false,
      stage: 'negociando',
      score: 50,
      source: 'Cotización de catálogo',
      notes: asString(body.notes).slice(0, 8000),
      drafts: [],
      messages: [],
      nextStep: 'Revisar y enviar la cotización preparada.',
      nextFollowUp: null,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    };
    const threads = store.get('threads');
    threads.unshift(thread);
    await store.set('threads', threads);
    await store.activity('reply', `Nueva conversación: ${thread.contact.company}.`, { threadId: thread.id });
    json(res, 201, { thread });
    return;
  }

  if (pathname === '/api/threads' && method === 'GET') {
    json(res, 200, { threads: store.get('threads').map((thread) => threadSummary(thread, store.get('suppressions'))) });
    return;
  }

  if (pathname === '/api/threads/all' && method === 'DELETE') {
    const count = store.get('threads').length;
    for (const item of outbox.items()) {
      if (['pending', 'failed'].includes(item.status)) {
        item.status = 'cancelled';
        item.error = 'Conversación borrada.';
      }
    }
    await outbox.save();
    await store.set('threads', []);
    await store.activity('reply', `Se borraron todas las conversaciones (${count}).`);
    json(res, 200, { ok: true, deleted: count });
    return;
  }

  // Reenviar los correos que se marcaron como enviados por el webhook falso.
  // Crea un borrador listo con el mismo texto para cada mensaje afectado,
  // sin borrar el registro del intento original.
  if (pathname === '/api/threads/prepare-resends' && method === 'POST') {
    const threads = store.get('threads');
    let prepared = 0;
    for (const thread of threads) {
      const affected = (thread.messages || []).filter((m) => m.deliveryNote && m.direction === 'out');
      if (!affected.length) continue;
      const yaPreparado = (thread.drafts || []).some((d) => d.reattemptOf && affected.some((m) => m.id === d.reattemptOf));
      if (yaPreparado) continue;
      for (const m of affected) {
        const draft = {
          id: uid('drf'),
          channel: 'email',
          language: 'es',
          subject: m.subject || '',
          body: m.body || '',
          status: 'listo',
          source: 'manual',
          guardVersion: 2,
          reattemptOf: m.id,
          note: 'Reenvío del mensaje que el webhook falso marcó como enviado. Revisá y enviá por tu correo.',
          createdAt: nowISO(),
        };
        thread.drafts = [draft, ...(thread.drafts || [])];
        prepared += 1;
      }
      thread.updatedAt = nowISO();
    }
    if (prepared) {
      await store.set('threads', threads);
      await store.activity('outreach', `Preparados ${prepared} reenvíos de correos no entregados.`);
    }
    json(res, 200, { ok: true, prepared });
    return;
  }

  const threadMatch = pathname.match(/^\/api\/threads\/([^/]+)$/);
  if (threadMatch) {
    const id = decodeURIComponent(threadMatch[1]);
    const thread = store.find('threads', id);
    if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
    if (method === 'GET') {
      const suppressed = isSuppressed(thread.contact?.email, threadSuppressions(thread), thread.contact?.company);
      json(res, 200, {
        thread: { ...thread, suppressed },
        product: store.find('products', thread.productId),
        mission: missionSummary(store.find('missions', thread.missionId) || {}),
      });
      return;
    }
    if (method === 'PATCH') {
      const body = await readJson(req);
      const threads = store.get('threads');
      const target = threads.find((t) => t.id === id);
      if (body.stage !== undefined) {
        if (!['nuevo', 'contactado', 'respondio', 'interesado', 'negociando', 'ganado', 'perdido'].includes(body.stage)) {
          throw new HttpError(400, 'Etapa inválida.');
        }
        if (target.stage !== body.stage) {
          await store.activity('reply', `${target.contact?.company || 'Contacto'} pasó a etapa ${body.stage}.`, { threadId: id });
          if (body.stage === 'ganado') {
            // El reloj de postventa (día 3/30/90) arranca con la venta actual,
            // no con la primera vez que el hilo pasó por "ganado". Si el
            // cliente volvió a comprar, se reinicia la secuencia y se descartan
            // los toques viejos que todavía no salieron.
            await markThreadWon(target);
            if (body.nextStep === undefined) target.nextStep = 'Venta cerrada. Postventa día 3, 30 y 90.';
          } else if (target.stage === 'ganado') {
            // Dejó de estar ganada: no corresponde seguir con la postventa.
            target.nextFollowUp = null;
            for (const item of outbox.items()) {
              if (item.status !== 'pending' || item.threadId !== target.id || item.kind !== 'postventa') continue;
              item.status = 'cancelled';
              item.error = 'La conversación dejó de estar en etapa ganado.';
            }
            await outbox.save();
          }
        }
        target.stage = body.stage;
      }
      if (body.notes !== undefined) target.notes = asString(body.notes).slice(0, 8000);
      if (body.nextStep !== undefined) target.nextStep = asString(body.nextStep).slice(0, 500);
      if (body.nextFollowUp !== undefined) {
        target.nextFollowUp = body.nextFollowUp ? new Date(body.nextFollowUp).toISOString() : null;
      }
      if (body.score !== undefined) target.score = clamp(asNumber(body.score), 0, 100);
      if (body.contact && typeof body.contact === 'object') {
        const contact = { ...target.contact };
        for (const key of ['name', 'company', 'role', 'email', 'emailStatus', 'country', 'city', 'website', 'type']) {
          if (body.contact[key] !== undefined) contact[key] = asString(body.contact[key]).slice(0, 300);
        }
        if (contact.email && !isValidEmail(contact.email)) throw new HttpError(400, 'El email del contacto no es válido.');
        if (normalizeEmail(contact.email) !== normalizeEmail(target.contact?.email)) {
          contact.permission = { status: 'unknown' }; // Un permiso nunca se transfiere a otra dirección.
        }
        if (body.contact.permission !== undefined) {
          const requested = body.contact.permission;
          if (!isObject(requested) || !['unknown', 'opted_in'].includes(requested.status)) {
            throw new HttpError(400, 'Estado de consentimiento inválido.');
          }
          if (requested.status === 'opted_in') {
            const evidence = asString(requested.evidence).trim().slice(0, 600);
            if (evidence.length < 10) throw new HttpError(400, 'Describí dónde y cuándo se obtuvo el consentimiento (mínimo 10 caracteres).');
            const sameEvidence = contact.permission?.status === 'opted_in' && contact.permission.evidence === evidence;
            contact.permission = { status: 'opted_in', source: 'manual', evidence,
              capturedAt: sameEvidence ? contact.permission.capturedAt : nowISO() };
          } else {
            contact.permission = { status: 'unknown' };
          }
        }
        target.contact = contact;
      }
      target.updatedAt = nowISO();
      target.lastActivityAt = target.lastActivityAt || target.updatedAt;
      await store.set('threads', threads);
      json(res, 200, { thread: target });
      return;
    }
    if (method === 'DELETE') {
      await store.set('threads', store.get('threads').filter((t) => t.id !== id));
      await store.activity('reply', `Conversación eliminada: ${thread.contact?.company || id}.`, { threadId: id });
      json(res, 200, { ok: true });
      return;
    }
  }

  const threadQuotes = pathname.match(/^\/api\/threads\/([^/]+)\/quotes$/);
  if (threadQuotes && method === 'POST') {
    const id = decodeURIComponent(threadQuotes[1]);
    const body = await readJson(req);
    const result = await createQuote(id, body);
    json(res, 201, result);
    return;
  }

  const threadQuoteMatch = pathname.match(/^\/api\/threads\/([^/]+)\/quotes\/([^/]+)$/);
  if (threadQuoteMatch && method === 'PATCH') {
    const id = decodeURIComponent(threadQuoteMatch[1]);
    const quoteId = decodeURIComponent(threadQuoteMatch[2]);
    const body = await readJson(req);
    const result = await setQuoteStatus(id, quoteId, asString(body.status));
    json(res, 200, result);
    return;
  }

  const threadMessages = pathname.match(/^\/api\/threads\/([^/]+)\/messages$/);
  if (threadMessages && method === 'POST') {
    const id = decodeURIComponent(threadMessages[1]);
    const body = await readJson(req);
    const threads = store.get('threads');
    const thread = threads.find((t) => t.id === id);
    if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
    const text = asString(body.body).trim();
    if (!text) throw new HttpError(400, 'El mensaje está vacío.');
    const direction = body.direction === 'out' ? 'out' : 'in';
    const message = {
      id: uid('msg'),
      direction,
      channel: asString(body.channel, 'email'),
      subject: asString(body.subject).slice(0, 300),
      body: text.slice(0, 30000),
      at: nowISO(),
      status: direction === 'in' ? 'recibido' : 'enviado_manual',
    };
    thread.messages = [...(thread.messages || []), message];
    thread.lastActivityAt = message.at;
    thread.updatedAt = message.at;
    if (direction === 'in') thread.lastInboundAt = message.at;
    const optOut = direction === 'in' ? await registerOptOut(thread, `${message.subject || ''}\n${message.body || ''}`, 'manual') : null;
    await store.set('threads', threads);
    await store.activity('reply', direction === 'in' ? `Respuesta recibida de ${thread.contact?.company || 'contacto'}.` : `Mensaje registrado para ${thread.contact?.company || 'contacto'}.`, { threadId: id });

    let analysis = null;
    let analysisError = null;
    if (direction === 'in' && body.analyze !== false && !optOut) {
      try {
        const result = await analyzeThread({ thread, store, apply: true });
        analysis = result.analysis;
      } catch (error) {
        analysisError = error.message;
      }
    }
    json(res, 200, { thread: store.find('threads', id), analysis, analysisError, optOut: Boolean(optOut) });
    return;
  }

  const threadDrafts = pathname.match(/^\/api\/threads\/([^/]+)\/drafts$/);
  if (threadDrafts && method === 'POST') {
    const id = decodeURIComponent(threadDrafts[1]);
    const body = await readJson(req);
    const threads = store.get('threads');
    const thread = threads.find((t) => t.id === id);
    if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
    if (isSuppressed(thread.contact?.email, threadSuppressions(thread), thread.contact?.company)) {
      throw new HttpError(400, 'Ese contacto está en la lista de no contactar. Quitalo de la lista antes de escribirle.');
    }
    const text = asString(body.body).trim();
    if (!text) throw new HttpError(400, 'El borrador está vacío.');
    const draft = {
      id: uid('drf'),
      channel: ['email', 'formulario', 'whatsapp', 'otro'].includes(body.channel) ? body.channel : 'email',
      language: asString(body.language, 'es').slice(0, 8),
      subject: asString(body.subject).slice(0, 300),
      body: text.slice(0, 30000),
      status: 'listo',
      source: 'manual',
      guardVersion: 2,
      createdAt: nowISO(),
    };
    thread.drafts = [draft, ...(thread.drafts || [])];
    thread.updatedAt = nowISO();
    await store.set('threads', threads);
    await store.activity('outreach', `Borrador creado para ${thread.contact?.company || 'contacto'}.`, { threadId: id });
    json(res, 201, { draft, thread });
    return;
  }

  const threadDraft = pathname.match(/^\/api\/threads\/([^/]+)\/drafts\/([^/]+)$/);
  if (threadDraft) {
    const id = decodeURIComponent(threadDraft[1]);
    const draftId = decodeURIComponent(threadDraft[2]);
    const threads = store.get('threads');
    const thread = threads.find((t) => t.id === id);
    if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
    const draft = (thread.drafts || []).find((d) => d.id === draftId);
    if (!draft) throw new HttpError(404, 'Borrador no encontrado.');
    if (method === 'PATCH') {
      const body = await readJson(req);
      const beforeEdit = {
        subject: draft.subject,
        body: draft.body,
        channel: draft.channel,
        language: draft.language,
      };
      if (body.subject !== undefined) draft.subject = asString(body.subject).slice(0, 300);
      if (body.body !== undefined) {
        const text = asString(body.body).trim();
        if (!text) throw new HttpError(400, 'El borrador está vacío.');
        draft.body = text.slice(0, 30000);
      }
      if (body.channel !== undefined) draft.channel = ['email', 'formulario', 'whatsapp', 'otro'].includes(body.channel) ? body.channel : draft.channel;
      if (body.language !== undefined) draft.language = asString(body.language, draft.language || 'es').slice(0, 8);
      const contentEdited = draft.subject !== beforeEdit.subject
        || draft.body !== beforeEdit.body
        || draft.channel !== beforeEdit.channel
        || draft.language !== beforeEdit.language;
      if (body.status !== undefined) {
        if (!['listo', 'revisar', 'descartado'].includes(body.status)) {
          throw new HttpError(400, 'Estado de borrador inválido. Para marcar un envío usá el botón Enviar.');
        }
        if (draft.status === 'enviado') throw new HttpError(400, 'Un borrador enviado no se puede modificar.');
        if (draft.status === 'bloqueado' && body.status !== 'descartado') {
          throw new HttpError(400, draft.blockedReason || 'Este borrador está bloqueado por cumplimiento o red team.');
        }
        if (body.status === 'listo' && draft.status === 'revisar') {
          if (isSuppressed(thread.contact?.email, threadSuppressions(thread), thread.contact?.company)) {
            throw new HttpError(400, 'Ese contacto está en la lista de no contactar: no se puede aprobar un envío.');
          }
          draft.approvedAt = nowISO();
          draft.approvedBy = 'dueño';
          draft.approvedReviewKind = draft.reviewKind || '';
          delete draft.lockedReview;
        }
        if (body.status === 'descartado') draft.discardedAt = nowISO();
        draft.status = body.status;
      }
      // Editar el texto de un borrador ya aprobado invalida la aprobación:
      // no se puede enviar un texto que el dueño no aprobó tal cual.
      if (contentEdited && body.status === undefined && draft.approvedAt && draft.status === 'listo') {
        draft.status = 'revisar';
        draft.reviewNote = 'El borrador cambió después de tu aprobación. Revisá el texto nuevo y aprobalo de nuevo.';
        delete draft.approvedAt;
        delete draft.approvedBy;
        delete draft.approvedReviewKind;
      }
      draft.updatedAt = nowISO();
      thread.updatedAt = nowISO();
      await store.set('threads', threads);
      json(res, 200, { draft, thread });
      return;
    }
    if (method === 'DELETE') {
      if (draft.status === 'enviado') throw new HttpError(400, 'Un borrador enviado no se puede borrar.');
      thread.drafts = (thread.drafts || []).filter((d) => d.id !== draftId);
      thread.updatedAt = nowISO();
      await store.set('threads', threads);
      json(res, 200, { ok: true });
      return;
    }
  }

  const threadAnalyze = pathname.match(/^\/api\/threads\/([^/]+)\/analyze$/);
  if (threadAnalyze && method === 'POST') {
    const id = decodeURIComponent(threadAnalyze[1]);
    const thread = store.find('threads', id);
    if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
    const result = await analyzeThread({ thread, store, apply: true });
    json(res, 200, result);
    return;
  }

  const threadSend = pathname.match(/^\/api\/threads\/([^/]+)\/send$/);
  if (threadSend && method === 'POST') {
    const id = decodeURIComponent(threadSend[1]);
    const body = await readJson(req);
    const { thread, message, draft } = await sendThreadMessage(id, body);
    json(res, 200, { ok: true, thread, message, draft });
    return;
  }

  const threadEml = pathname.match(/^\/api\/threads\/([^/]+)\/eml$/);
  if (threadEml && method === 'GET') {
    const id = decodeURIComponent(threadEml[1]);
    const thread = store.find('threads', id);
    if (!thread) throw new HttpError(404, 'Conversación no encontrada.');
    const draftId = url.searchParams.get('draftId');
    let draft;
    if (draftId) {
      draft = (thread.drafts || []).find((d) => d.id === draftId);
      if (!draft) throw new HttpError(404, 'Borrador no encontrado.');
    } else {
      draft = (thread.drafts || []).find((d) => d.status === 'listo');
    }
    if (!draft) throw new HttpError(400, 'No hay un borrador aprobado para descargar. Aprobá uno primero.');
    if (draft.status === 'bloqueado') throw new HttpError(400, draft.blockedReason || 'Ese borrador está bloqueado; no se puede descargar para enviar.');
    if (draft.status === 'revisar') throw new HttpError(400, 'Ese borrador está en revisión. Aprobalo antes de descargarlo.');
    if (draft.status !== 'listo') throw new HttpError(400, 'Ese borrador ya fue enviado o descartado.');
    const settings = store.settings();
    if (!settings.email?.from && !settings.brand?.email) throw new HttpError(400, 'Configurá un remitente en Ajustes → Correo antes de descargar el .eml.');
    if (!isValidEmail(thread.contact?.email)) throw new HttpError(400, 'El contacto no tiene un email válido.');
    if (isSuppressed(thread.contact?.email, threadSuppressions(thread), thread.contact?.company)) {
      throw new HttpError(400, 'Ese contacto pidió no recibir más mensajes (lista de no contactar).');
    }
    let message;
    try {
      message = composeEmail(thread, draft, settings);
    } catch (error) {
      throw new HttpError(400, error.message || 'No se pudo preparar el archivo .eml.');
    }
    let eml;
    try {
      eml = buildEml(message);
    } catch (error) {
      throw new HttpError(400, error.message || 'No se pudo preparar el archivo .eml.');
    }
    const name = emlFilename(thread, draft);
    const asciiName = name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    res.writeHead(200, {
      'content-type': 'message/rfc822; charset=utf-8',
      'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'cache-control': 'no-store',
    });
    res.end(eml);
    return;
  }

  if (pathname === '/api/content' && method === 'GET') {
    json(res, 200, { content: store.get('content') });
    return;
  }

  if (pathname === '/api/content/all' && method === 'DELETE') {
    const count = store.get('content').length;
    await store.set('content', []);
    await store.activity('content', `Se borró todo el contenido (${count}).`);
    json(res, 200, { ok: true, deleted: count });
    return;
  }

  const contentMatch = pathname.match(/^\/api\/content\/([^/]+)$/);
  if (contentMatch) {
    const id = decodeURIComponent(contentMatch[1]);
    const item = store.find('content', id);
    if (!item) throw new HttpError(404, 'Pieza de contenido no encontrada.');
    if (method === 'PATCH') {
      const body = await readJson(req);
      const allowed = ['status', 'caption', 'hook', 'script', 'cta', 'platform', 'format', 'day', 'hashtags', 'publishedUrl', 'publishedAt'];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        item[key] = key === 'hashtags' ? asArray(body[key]).map(String) : asString(body[key]).slice(0, 500);
      }
      if (body.status && !['idea', 'borrador', 'publicado', 'archivado'].includes(body.status)) throw new HttpError(400, 'Estado de contenido inválido.');
      if (body.publishedUrl !== undefined) {
        const raw = String(body.publishedUrl || '').trim();
        if (raw && !/^https?:\/\//i.test(raw)) throw new HttpError(400, 'El enlace de publicación debe ser una URL válida (http/https).');
        if (!raw) { delete item.publishedUrl; }
      }
      if (body.publishedAt !== undefined && !String(body.publishedAt || '').trim()) delete item.publishedAt;
      // Marcar como publicada sin fecha: se anota el momento. Es lo que permite
      // responder "¿dónde y cuándo la IA la publicó?" sin adivinar.
      if (body.status === 'publicado' && item.status !== 'publicado' && !item.publishedAt && body.publishedAt === undefined) {
        item.publishedAt = nowISO();
      }
      item.updatedAt = nowISO();
      await store.set('content', store.get('content'));
      json(res, 200, { item });
      return;
    }
    if (method === 'DELETE') {
      await store.set('content', store.get('content').filter((c) => c.id !== id));
      json(res, 200, { ok: true });
      return;
    }
  }

  if (pathname === '/api/learnings' && method === 'GET') {
    json(res, 200, { learnings: store.get('learnings') });
    return;
  }

  if (pathname === '/api/learnings' && method === 'POST') {
    const body = await readJson(req);
    const insight = asString(body.insight).trim();
    if (!insight) throw new HttpError(400, 'El aprendizaje necesita un texto.');
    const item = {
      id: uid('lrn'),
      demo: false,
      missionId: null,
      scope: asString(body.scope, 'General'),
      insight: insight.slice(0, 1200),
      evidence: asString(body.evidence).slice(0, 2000),
      confidence: ['alta', 'media', 'baja'].includes(body.confidence) ? body.confidence : 'media',
      apply: asString(body.apply).slice(0, 1000),
      tag: ['precio', 'mensaje', 'mercado', 'aduanas', 'operacion'].includes(body.tag) ? body.tag : 'operacion',
      pinned: false,
      createdAt: nowISO(),
    };
    store.get('learnings').unshift(item);
    await store.set('learnings', store.get('learnings'));
    await store.activity('system', 'Aprendizaje agregado a mano.');
    json(res, 201, { item });
    return;
  }

  const learningMatch = pathname.match(/^\/api\/learnings\/([^/]+)$/);
  if (learningMatch) {
    const id = decodeURIComponent(learningMatch[1]);
    const item = store.find('learnings', id);
    if (!item) throw new HttpError(404, 'Aprendizaje no encontrado.');
    if (method === 'PATCH') {
      const body = await readJson(req);
      if (body.pinned !== undefined) item.pinned = Boolean(body.pinned);
      if (body.insight !== undefined) item.insight = asString(body.insight).slice(0, 1200);
      if (body.apply !== undefined) item.apply = asString(body.apply).slice(0, 1000);
      await store.set('learnings', store.get('learnings'));
      json(res, 200, { item });
      return;
    }
    if (method === 'DELETE') {
      await store.set('learnings', store.get('learnings').filter((l) => l.id !== id));
      json(res, 200, { ok: true });
      return;
    }
  }

  if (pathname === '/api/suppressions' && method === 'GET') {
    json(res, 200, { suppressions: store.get('suppressions') });
    return;
  }

  if (pathname === '/api/suppressions' && method === 'POST') {
    const body = await readJson(req);
    const suppression = await addSuppression(body, { source: 'manual' });
    json(res, 201, { suppression, suppressions: store.get('suppressions') });
    return;
  }

  const suppressionMatch = pathname.match(/^\/api\/suppressions\/([^/]+)$/);
  if (suppressionMatch && method === 'DELETE') {
    const id = decodeURIComponent(suppressionMatch[1]);
    const item = store.find('suppressions', id);
    if (!item) throw new HttpError(404, 'Contacto no encontrado en la lista.');
    await store.set('suppressions', store.get('suppressions').filter((s) => s.id !== id));
    const release = await releaseSuppression(item);
    await store.activity('system', `Contacto reactivado: ${item.email || item.domain || item.company}.${release.released ? ` ${release.released} borrador(es) volvieron a revisión.` : ''}`, { suppressionId: id });
    json(res, 200, { ok: true, ...release });
    return;
  }

  if (pathname === '/api/activity' && method === 'GET') {
    json(res, 200, { activity: store.get('activity').slice(0, 100) });
    return;
  }

  if (pathname === '/api/intel' && method === 'GET') {
    json(res, 200, buildIntel(store.get('missions')));
    return;
  }

  if (pathname === '/api/ask' && method === 'POST') {
    const body = await readJson(req);
    const question = asString(body.question).trim();
    if (!question) throw new HttpError(400, 'Escribí una pregunta.');
    const result = await askTeam({ question: question.slice(0, 2500), agentId: asString(body.agentId, 'director'), store });
    json(res, 200, result);
    return;
  }

  if (pathname === '/api/demo/seed' && method === 'POST') {
    const result = await seedDemo(store);
    await store.activity('system', 'Se cargaron datos de ejemplo.', { demo: true });
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (pathname === '/api/demo' && method === 'DELETE') {
    await clearDemo(store);
    json(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/backup' && method === 'GET') {
    // Por defecto el backup NO incluye secretos. Para exportar claves hace
    // falta pedirlo explícitamente con ?secrets=1 (y estar en local).
    const includeSecrets = url.searchParams.get('secrets') === '1' && url.searchParams.get('safe') !== '1';
    const safe = !includeSecrets;
    const zip = await makeBackup({ safe });
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="lucian-backup-${stamp}.zip"`,
      'cache-control': 'no-store',
      'content-length': zip.length,
    });
    res.end(zip);
    return;
  }

  if (pathname === '/api/restore' && method === 'POST') {
    const zip = await readBody(req, RESTORE_LIMIT);
    const result = await restoreBackup(zip);
    json(res, 200, { ok: true, ...result });
    return;
  }

  if (pathname === '/api/export/products.csv' && method === 'GET') {
    const rows = store.get('products').map((p) => ({
      codigo: p.code, nombre: p.name, categoria: p.category, precio: p.price, moneda: p.currency,
      costo: p.cost, estado: p.status, descripcion: p.description,
      capacidad: p.capacityPerWeek, plazo: p.leadTimeDays, medidas: p.dimensions, peso: p.weightGrams,
    }));
    const csv = toCsv(rows, [
      { key: 'codigo', label: 'Código' }, { key: 'nombre', label: 'Nombre' }, { key: 'categoria', label: 'Categoría' },
      { key: 'precio', label: 'Precio' }, { key: 'moneda', label: 'Moneda' }, { key: 'costo', label: 'Costo' },
      { key: 'estado', label: 'Estado' }, { key: 'descripcion', label: 'Descripción' },
      { key: 'capacidad', label: 'Capacidad semanal' }, { key: 'plazo', label: 'Plazo de fabricación (días)' },
      { key: 'medidas', label: 'Medidas' }, { key: 'peso', label: 'Peso (gramos)' },
    ]);
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="lucian-productos.csv"' });
    res.end(csv);
    return;
  }

  if (pathname === '/api/export/threads.csv' && method === 'GET') {
    const rows = store.get('threads').map((t) => ({
      empresa: t.contact?.company, contacto: t.contact?.name, email: t.contact?.email, pais: t.contact?.country,
      etapa: t.stage, score: t.score, siguiente: t.nextStep,
    }));
    const csv = toCsv(rows, [
      { key: 'empresa', label: 'Empresa' }, { key: 'contacto', label: 'Contacto' }, { key: 'email', label: 'Email' },
      { key: 'pais', label: 'País' }, { key: 'etapa', label: 'Etapa' }, { key: 'score', label: 'Score' },
      { key: 'siguiente', label: 'Siguiente paso' },
    ]);
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="lucian-conversaciones.csv"' });
    res.end(csv);
    return;
  }

  if (pathname === '/api/webhooks/email' && method === 'POST') {
    const expected = process.env.LUCIAN_WEBHOOK_TOKEN || store.settings().email?.webhookToken || '';
    if (expected) {
      const provided = req.headers['x-lucian-token'] || url.searchParams.get('token');
      if (!webhookTokenMatches(provided, expected)) throw new HttpError(401, 'Token de webhook inválido.');
    } else if (!isLocalWebhookRequest(req)) {
      throw new HttpError(403, 'Para recibir correos desde internet configurá un token de webhook en Ajustes → Correo o la variable LUCIAN_WEBHOOK_TOKEN.');
    }
    const payload = await readJson(req, 10 * 1024 * 1024);
    const emailEvent = parseEmailEvent(payload);
    if (emailEvent) {
      const result = await handleEmailEvent(emailEvent);
      json(res, 200, { ok: true, event: emailEvent.kind, ...result });
      return;
    }
    const inbound = parseInbound(payload);
    if (!inbound) throw new HttpError(400, 'No se pudo leer el correo entrante.');
    const thread = await processInboundEmail(inbound);
    json(res, 200, { ok: true, threadId: thread.id });
    return;
  }

  if (pathname === '/api/webhooks/whatsapp' && method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = process.env.META_VERIFY_TOKEN || store.settings().notify?.whatsapp?.verifyToken || '';
    if (!expected) { fail(res, 503, 'Configurá META_VERIFY_TOKEN para activar WhatsApp.'); return; }
    if (mode === 'subscribe' && token === expected) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(challenge || 'ok');
    } else {
      fail(res, 403, 'Verificación fallida.');
    }
    return;
  }

  if (pathname === '/api/webhooks/whatsapp' && method === 'POST') {
    const appSecret = String(process.env.META_APP_SECRET || '');
    if (!appSecret) { fail(res, 503, 'Configurá META_APP_SECRET para recibir webhooks de WhatsApp.'); return; }
    const rawBody = await readBody(req, 5 * 1024 * 1024);
    if (!verifyMetaSignature(rawBody, req.headers['x-hub-signature-256'], appSecret)) {
      fail(res, 401, 'Firma de Meta inválida.');
      return;
    }
    let payload;
    try { payload = JSON.parse(rawBody.toString('utf8')); }
    catch { throw new HttpError(400, 'El cuerpo del webhook no es JSON válido.'); }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    const settings = store.settings();
    const messages = parseWhatsAppWebhook(payload);
    const owner = String(settings.notify?.whatsapp?.to || '').replace(/\D/g, '');
    for (const message of messages) {
      if (!message.text) continue;
      if (owner && message.from.replace(/\D/g, '') !== owner) continue;
      const reply = await notifier.handleOwnerText(message.text, 'whatsapp');
      if (reply) await sendWhatsApp(store.settings(), reply).catch(() => {});
    }
    return;
  }

  fail(res, 404, 'Ruta no encontrada.');
}

/* ─────────────────────────────────────────────────────────────
   Servidor
   ───────────────────────────────────────────────────────────── */

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error('[Lucian]', error);
    if (!res.headersSent) {
      fail(res, status, error.message || 'Error interno.');
    } else {
      try { res.end(); } catch { /* noop */ }
    }
  });
});

server.requestTimeout = 15 * 60 * 1000;
server.headersTimeout = 120000;
server.keepAliveTimeout = 65000;

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

let port = START_PORT;
for (let attempt = 0; attempt < 8; attempt += 1) {
  try {
    await listen(port + attempt);
    port += attempt;
    break;
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
    if (attempt === 7) throw error;
  }
}

const url = `http://localhost:${port}`;
const lanMode = HOST === '0.0.0.0' || HOST === '::';
const lanUrl = lanMode
  ? `http://<IP-de-esta-PC>:${port}`
  : '';
// Clave de acceso obligatoria cuando la app se expone fuera de la PC.
// Se genera al arrancar y se muestra en consola. En local no se pide.
const ACCESS_TOKEN = process.env.LUCIAN_ACCESS_TOKEN || crypto.randomBytes(24).toString('base64url');
if (ACCESS_TOKEN.length < 20) throw new Error('LUCIAN_ACCESS_TOKEN debe tener al menos 20 caracteres.');
// Escribir la clave en un archivo para que el script de túnel la muestre
if (lanMode) {
  try { await import('node:fs/promises').then((m) => m.writeFile(path.join(__dirname, 'access-key.txt'), ACCESS_TOKEN, { encoding: 'utf8', mode: 0o600 })); } catch { /* noop */ }
}
const settings = store.settings();
const aiLabel = isAIReady(settings) ? `${settings.ai.provider} · ${resolveAIConfig(settings).model}` : 'modo demo (sin clave de IA)';

/* Panel de listo para funcionar: solo conteos y booleanos. Nunca imprime
   claves ni tokens. Sirve para saber de un vistazo qué está pendiente antes
   de abrir el navegador. */
function readinessLines() {
  const threads = store.get('threads') || [];
  const drafts = threads.flatMap((t) => t.drafts || []);
  const pending = drafts.filter((d) => d.status === 'listo').length;
  const reviewing = drafts.filter((d) => d.status === 'revisar').length;
  const won = threads.filter((t) => t.stage === 'ganado').length;
  const open = threads.filter((t) => ['respondio', 'interesado', 'negociando'].includes(t.stage)).length;
  const email = settings.email || {};
  const emailLabel = email.provider === 'manual'
    ? 'manual (nada sale solo)'
    : email.provider === 'resend'
      ? (email.resendKey ? 'Resend conectado' : 'Resend elegido pero sin clave')
      : email.provider === 'webhook'
        ? (email.webhookUrl ? 'webhook configurado' : 'webhook elegido pero sin URL')
        : `${email.provider}`;
  const tg = settings.notify?.telegram;
  const telegramLabel = tg?.enabled && tg?.token && tg?.chatId ? `configurado (avisos día ${tg.digestHour ?? 9}:00)` : 'apagado (Ajustes → Notificaciones)';
  const queued = (store.get('missions') || []).filter((m) => m.status === 'queued').length;
  const lines = [
    '  Listo para funcionar:',
    `  · IA: ${aiLabel}`,
    `  · Datos: ${DATA_DIR}`,
    `  · Búsqueda: ${settings.search?.provider || 'duckduckgo'}${settings.search?.provider === 'tavily' && !(settings.search?.tavilyKey || settings.search?.apiKey) ? ' (sin clave: usa solo la rotación sin clave)' : ''}`,
    `  · Correo: ${emailLabel}${email.autopilot ? ' · piloto automático ACTIVO' : ''}`,
    `  · Calentamiento: ${email.warmup !== false ? 'activo' : 'desactivado'} · límite diario ${email.dailyLimit ?? 20}`,
    `  · Telegram (avisos y chat con el equipo): ${telegramLabel}`,
    `  · Postventa (fidelización día 3/30/90): ${email.postSales !== false ? 'preparada, siempre con tu aprobación' : 'apagada'}`,
    `  · Seguimientos: ${email.followUps !== false ? 'preparados, siempre con tu aprobación' : 'apagados'}`,
    `  · Esperando tu decisión: ${pending} listo${pending === 1 ? '' : 's'} y ${reviewing} por revisar`,
    `  · Conversaciones abiertas que esperan tu respuesta: ${open}${won ? ` · ganadas (con postventa en marcha): ${won}` : ''}`,
    queued ? `  · Misiones en cola retomadas al arrancar: ${queued}` : null,
  ].filter(Boolean);
  return lines;
}
console.log('');
console.log('  LUCIAN · sistema de ventas para lámparas de diseño');
console.log(`  ${url}`);
if (lanUrl) {
  console.log(`  Desde otra PC de la red: ${lanUrl}`);
  console.log('');
  console.log('  ┌──────────────────────────────────────────────────────────┐');
  console.log('  │  CLAVE DE ACCESO (pedila en esta PC para abrir Lucian)  │');
  console.log(`  │           ${ACCESS_TOKEN}           │`);
  console.log('  └──────────────────────────────────────────────────────────┘');
  console.log('  Sin esta clave, nadie puede usar la API desde otra PC.');
}
console.log('  Ctrl+C para cerrar.');
console.log('');
for (const line of readinessLines()) console.log(line);
console.log('');

if (!process.env.LUCIAN_NO_OPEN) {
  setTimeout(() => {
    const command = process.platform === 'win32'
      ? `cmd /c start "" "${url}"`
      : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(command, () => {});
  }, 900).unref?.();
}

async function shutdown() {
  console.log('\nCerrando Lucian”¦');
  notifier.stop();
  outbox.stop();
  try { await store.flush(); } catch { /* noop */ }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (error) => console.error('[Lucian] Promesa rechazada:', error));
