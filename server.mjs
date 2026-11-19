import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

import { Store, maskSettings, settingsFlags } from './lib/store.mjs';
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
  parseInbound, sendWithResend, sendWithWebhook, testResend,
} from './lib/email.mjs';
import { Notifier, parseWhatsAppWebhook, sendWhatsApp, telegramChats, testTelegram, testWhatsApp } from './lib/notify.mjs';
import {
  analyzeThread, askTeam, migrateLegacyDrafts, reconcileThreads, runMission, sanitizeLegacyThreads,
} from './lib/agents.mjs';
import { DEPTHS, STEPS } from './lib/prompts.mjs';
import { clearDemo, seedDemo } from './lib/demo.mjs';
import { createZip, readZip } from './lib/zip.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.LUMBRE_DATA_DIR ? path.resolve(process.env.LUMBRE_DATA_DIR) : path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const VERSION = '1.0.0';
const HOST = process.env.LUMBRE_HOST || '127.0.0.1';
const START_PORT = Number(process.env.PORT || process.env.LUMBRE_PORT || 4321);
const BODY_LIMIT = 40 * 1024 * 1024;
const RESTORE_LIMIT = 160 * 1024 * 1024;

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
        fuente: country.fuente || previous?.fuente || '',
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
  ask: async (question) => {
    const result = await askTeam({ question, agentId: 'director', store });
    return result.demo ? `(Modo demo) ${result.answer}` : result.answer;
  },
});
notifier.start();

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
    app: { name: 'Lumbre', version: VERSION, now: nowISO(), demoMode: flags.demo, dataDir: store.dataDir },
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
    limits: dailyLimitInfo(settings, threads),
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

function productFields(body, existing, id) {
  const name = asString(body.name ?? existing?.name).trim();
  if (!name) throw new HttpError(400, 'El producto necesita un nombre.');
  const price = body.price === undefined ? Number(existing?.price ?? 0) : asNumber(body.price);
  const status = ['borrador', 'listo', 'archivado'].includes(body.status) ? body.status : existing?.status || 'borrador';
  return {
    name,
    code: asString(body.code ?? existing?.code).trim() || existing?.code || `LUM-${id.slice(-4).toUpperCase()}`,
    category: asString(body.category ?? existing?.category, 'Lámpara'),
    price: Math.max(0, price),
    currency: asString(body.currency ?? existing?.currency, store.settings().brand.currency || 'USD').toUpperCase().slice(0, 6),
    cost: body.cost === undefined ? Number(existing?.cost ?? 0) : Math.max(0, asNumber(body.cost)),
    weightGrams: body.weightGrams === undefined ? Number(existing?.weightGrams ?? 0) : Math.max(0, asNumber(body.weightGrams)),
    dimensions: asString(body.dimensions ?? existing?.dimensions),
    materials: asString(body.materials ?? existing?.materials),
    description: asString(body.description ?? existing?.description),
    notes: asString(body.notes ?? existing?.notes),
    status,
  };
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
    runMission(id, { store, broadcast, notifier }).catch((error) => {
      console.error('[Lumbre] Error no controlado en la misión:', error);
    });
  }, 80);
  return mission;
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
  setTimeout(() => runMission(id, { store, broadcast, notifier }).catch((error) => console.error(error)), 80);
  return mission;
}

/* ─────────────────────────────────────────────────────────────
   Hilos y envío
   ───────────────────────────────────────────────────────────── */

function threadSuppressions(thread) {
  return (store.get('suppressions') || []).filter((item) => thread.demo || !item.demo);
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
  const channel = ['resend', 'webhook', 'manual'].includes(body.channel) ? body.channel : 'manual';
  const company = thread.contact?.company || '';
  let message;
  try {
    message = composeEmail(thread, draft, settings);
  } catch (error) {
    throw new HttpError(400, error.message || 'No se pudo preparar el mensaje.');
  }

  try {
    assertCanSend(settings, threads, message.to, threadSuppressions(thread), {
      manual: channel === 'manual',
      company,
    });
  } catch (error) {
    throw new HttpError(400, error.message || 'No se puede enviar este mensaje.');
  }

  if (channel === 'manual') {
    if (body.confirm !== true) throw new HttpError(400, 'Para marcar un mensaje como enviado necesitás confirmarlo.');
  } else {
    if (channel === 'resend') {
      try { await sendWithResend(settings, message); } catch (error) { throw new HttpError(502, error.message || 'Resend rechazó el envío.'); }
    }
    if (channel === 'webhook') {
      try { await sendWithWebhook(settings, message, { threadId: thread.id, contact: thread.contact }); } catch (error) { throw new HttpError(502, error.message || 'El webhook rechazó el envío.'); }
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
  };
  thread.messages = [...(thread.messages || []), sent];
  draft.status = 'enviado';
  draft.sentAt = now;
  draft.sentChannel = channel;
  if (thread.stage === 'nuevo') thread.stage = 'contactado';
  thread.lastActivityAt = now;
  thread.updatedAt = now;
  thread.nextStep = 'Seguimiento con valor en 4 días.';
  thread.nextFollowUp = new Date(Date.now() + 4 * 86400000).toISOString();
  await store.set('threads', threads);
  await store.activity('outreach', `Mensaje ${channel === 'manual' ? 'marcado como enviado' : 'enviado'} a ${thread.contact?.company || message.to || 'el contacto'}.`, { threadId, channel });
  return { thread, message: sent, draft };
}

function findThreadForEmail(email) {
  const target = String(email || '').toLowerCase();
  return store.get('threads').find((t) => String(t.contact?.email || '').toLowerCase() === target) || null;
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
    reason: `Respondió pidiendo no recibir más mensajes (${signal.rule}: “${String(signal.phrase).slice(0, 90)}”).`,
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

async function makeBackup() {
  const bundle = store.exportBundle();
  const entries = [
    { name: 'lumbre-data.json', data: Buffer.from(JSON.stringify(bundle, null, 2), 'utf8') },
    {
      name: 'LEEME-BACKUP.txt',
      data: Buffer.from(`Copia de seguridad de Lumbre\nFecha: ${nowISO()}\n\nIncluye datos y fotos. Contiene claves de API en texto plano: guardala en un lugar privado.\nPara restaurar: Ajustes → Datos → Restaurar copia.\n`, 'utf8'),
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
    const dataEntry = entries.find((e) => e.name === 'lumbre-data.json');
    if (!dataEntry) throw new HttpError(400, 'La copia no contiene lumbre-data.json.');
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
  setCommonHeaders(res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method || 'GET';

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

  if (pathname === '/api/health' && method === 'GET') {
    json(res, 200, {
      ok: true,
      app: 'lumbre',
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

  if (pathname === '/api/settings' && method === 'PUT') {
    const body = await readJson(req);
    const settings = await store.saveSettings(body);
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
      store.set('products', store.get('products').filter((p) => p.id !== id));
      await store.set('products', store.get('products'));
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
      store.set('missions', store.get('missions').filter((m) => m.id !== id));
      await store.set('missions', store.get('missions'));
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
      if (mission.status === 'queued') {
        mission.status = 'cancelled';
        mission.finishedAt = nowISO();
        mission.phase = 'cancelled';
      }
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

  if (pathname === '/api/threads' && method === 'GET') {
    json(res, 200, { threads: store.get('threads').map((thread) => threadSummary(thread, store.get('suppressions'))) });
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
        target.contact = contact;
      }
      target.updatedAt = nowISO();
      target.lastActivityAt = target.lastActivityAt || target.updatedAt;
      await store.set('threads', threads);
      json(res, 200, { thread: target });
      return;
    }
    if (method === 'DELETE') {
      store.set('threads', store.get('threads').filter((t) => t.id !== id));
      await store.set('threads', store.get('threads'));
      await store.activity('reply', `Conversación eliminada: ${thread.contact?.company || id}.`, { threadId: id });
      json(res, 200, { ok: true });
      return;
    }
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

  const contentMatch = pathname.match(/^\/api\/content\/([^/]+)$/);
  if (contentMatch) {
    const id = decodeURIComponent(contentMatch[1]);
    const item = store.find('content', id);
    if (!item) throw new HttpError(404, 'Pieza de contenido no encontrada.');
    if (method === 'PATCH') {
      const body = await readJson(req);
      const allowed = ['status', 'caption', 'hook', 'script', 'cta', 'platform', 'format', 'day', 'hashtags'];
      for (const key of allowed) {
        if (body[key] === undefined) continue;
        item[key] = key === 'hashtags' ? asArray(body[key]).map(String) : asString(body[key]);
      }
      if (body.status && !['idea', 'borrador', 'publicado', 'archivado'].includes(body.status)) throw new HttpError(400, 'Estado de contenido inválido.');
      item.updatedAt = nowISO();
      await store.set('content', store.get('content'));
      json(res, 200, { item });
      return;
    }
    if (method === 'DELETE') {
      store.set('content', store.get('content').filter((c) => c.id !== id));
      await store.set('content', store.get('content'));
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
      store.set('learnings', store.get('learnings').filter((l) => l.id !== id));
      await store.set('learnings', store.get('learnings'));
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
    store.set('suppressions', store.get('suppressions').filter((s) => s.id !== id));
    await store.set('suppressions', store.get('suppressions'));
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
    const zip = await makeBackup();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="lumbre-backup-${stamp}.zip"`,
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
    }));
    const csv = toCsv(rows, [
      { key: 'codigo', label: 'Código' }, { key: 'nombre', label: 'Nombre' }, { key: 'categoria', label: 'Categoría' },
      { key: 'precio', label: 'Precio' }, { key: 'moneda', label: 'Moneda' }, { key: 'costo', label: 'Costo' },
      { key: 'estado', label: 'Estado' }, { key: 'descripcion', label: 'Descripción' },
    ]);
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="lumbre-productos.csv"' });
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
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="lumbre-conversaciones.csv"' });
    res.end(csv);
    return;
  }

  if (pathname === '/api/webhooks/email' && method === 'POST') {
    const expected = process.env.LUMBRE_WEBHOOK_TOKEN || store.settings().email?.webhookToken || '';
    if (expected) {
      const provided = req.headers['x-lumbre-token'] || url.searchParams.get('token');
      if (!webhookTokenMatches(provided, expected)) throw new HttpError(401, 'Token de webhook inválido.');
    } else if (!isLocalWebhookRequest(req)) {
      throw new HttpError(403, 'Para recibir correos desde internet configurá un token de webhook en Ajustes → Correo o la variable LUMBRE_WEBHOOK_TOKEN.');
    }
    const payload = await readJson(req, 10 * 1024 * 1024);
    const inbound = parseInbound(payload);
    if (!inbound) throw new HttpError(400, 'No se pudo leer el correo entrante.');
    const match = inbound.from.match(/<([^>]+)>/);
    const email = (match ? match[1] : inbound.from).trim().toLowerCase();
    if (!isValidEmail(email)) throw new HttpError(400, 'El remitente no es un email válido.');
    let thread = findThreadForEmail(email);
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
    };
    thread.messages = [...(thread.messages || []), message];
    thread.lastActivityAt = now;
    thread.updatedAt = now;
    const optOut = await registerOptOut(thread, `${inbound.subject || ''}\n${message.body || ''}`, 'webhook');
    if (!optOut && thread.stage === 'contactado') thread.stage = 'respondio';
    await store.set('threads', store.get('threads'));
    await store.activity('reply', `Respuesta de ${email}: ${truncate(inbound.subject || message.body, 140)}`, { threadId: thread.id });

    if (optOut) {
      await notifier.notify(
        `${thread.contact?.company || email} pidió no recibir más mensajes.\n\nLo agregué a la lista de no contactar. No se le va a escribir de nuevo.`,
        { kind: 'opt_out' },
      ).catch(() => {});
    }

    if (!optOut && isAIReady(store.settings())) {
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
    json(res, 200, { ok: true, threadId: thread.id });
    return;
  }

  if (pathname === '/api/webhooks/whatsapp' && method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = store.settings().notify?.whatsapp?.verifyToken || 'lumbre';
    if (mode === 'subscribe' && token === expected) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(challenge || 'ok');
    } else {
      fail(res, 403, 'Verificación fallida.');
    }
    return;
  }

  if (pathname === '/api/webhooks/whatsapp' && method === 'POST') {
    const payload = await readJson(req, 5 * 1024 * 1024);
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
    if (status >= 500) console.error('[Lumbre]', error);
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
const settings = store.settings();
const aiLabel = isAIReady(settings) ? `${settings.ai.provider} · ${resolveAIConfig(settings).model}` : 'modo demo (sin clave de IA)';
console.log('');
console.log('  LUMBRE · sistema de ventas para lámparas de diseño');
console.log(`  ${url}`);
console.log(`  IA: ${aiLabel}`);
console.log(`  Datos: ${DATA_DIR}`);
console.log('  Ctrl+C para cerrar.');
console.log('');

if (!process.env.LUMBRE_NO_OPEN) {
  setTimeout(() => {
    const command = process.platform === 'win32'
      ? `cmd /c start "" "${url}"`
      : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(command, () => {});
  }, 900).unref?.();
}

async function shutdown() {
  console.log('\nCerrando Lumbre…');
  notifier.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (error) => console.error('[Lumbre] Promesa rechazada:', error));
