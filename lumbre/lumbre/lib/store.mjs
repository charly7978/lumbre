import { nowISO, uid } from './util.mjs';
import { isAIReady } from './ai.mjs';
import crypto from 'node:crypto';

/* ─────────────────────────────────────────────────────────────
   Ajustes por defecto. Todo vive en data/settings.json.
   ───────────────────────────────────────────────────────────── */

export const DEFAULT_SETTINGS = {
  version: 1,
  brand: {
    name: 'Lucian',
    maker: '',
    tagline: 'Lámparas de diseño impresas en 3D',
    city: '',
    country: '',
    website: '',
    instagram: '',
    email: '',
    address: '',
    currency: 'USD',
    languages: ['es', 'en'],
  },
  onboarding: {
    done: false,
    demoLoaded: false,
    startedAt: null,
  },
  ai: {
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    visionModel: '',
    temperature: 0.6,
    maxTokens: 8192,
  },
  search: {
    provider: 'duckduckgo',
    apiKey: '',
    searxUrl: '',
    depth: 'search+pages',
    maxResults: 8,
    prospectingDepth: 'advanced',
    cacheHours: 24,
  },
  hunter: {
    apiKey: '',
    enabled: false,
  },
  // Piloto de conexiones: los agentes revisan y reparan conexiones solos.
  autopilot: {
    enabled: true,
    intervalMinutes: 10,
  },
  // IA de respaldo: cuando el proveedor principal se queda sin cuota,
  // Lucian cambia automáticamente a Ollama local (gratis e ilimitado).
  fallback: {
    enabled: true,
    ollama: {
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen2.5:3b',
    },
  },
  email: {
    provider: 'manual',
    resendKey: '',
    smtpUser: '',
    smtpPassword: '',
    from: '',
    replyTo: '',
    footer: '',
    dailyLimit: 20,
    warmup: true,
    webhookUrl: '',
    webhookToken: '',
    // Piloto automático: envía solo borradores que ya pasaron las guardas.
    // Apagado por defecto. Requiere Resend o webhook (nunca "manual").
    autopilot: false,
    autopilotSpacingMin: 5,
    followUps: true,
    // Postventa (fidelización): toques día 3/30/90 tras marcar una conversación
    // como ganado. Misma regla: sin piloto quedan "Por aprobar".
    postSales: true,
  },
  notify: {
    paused: false,
    telegram: { enabled: false, token: '', chatId: '', digestHour: 9 },
    whatsapp: { enabled: false, token: '', phoneNumberId: '', to: '', verifyToken: '', apiVersion: 'v23.0' },
    events: { missionDone: true, missionError: true, missionWarning: true, hotReply: true, optOut: true, digest: true },
  },
  mission: {
    depth: 'estandar',
    markets: ['España', 'México', 'Estados Unidos'],
    tone: 'cercano, experto, sin presión',
    currency: 'USD',
    maxProspects: 12,
    autoCreateThreads: true,
    researchPages: true,
    reviewDirectory: true,
    // Un comprador no se vuelve a contactar antes de este plazo. Evita
    // quemar el mercado y permite venderle otro producto más adelante.
    contactCooldownDays: 90,
  },
  sales: {
    // Link de pago global (Stripe, MercadoPago, PayPal”¦). Cada producto puede
    // pisarlo con su propio link.
    paymentLink: '',
    quoteValidityDays: 15,
    shippingPolicy: '',
  },
};

export const SECRET_PATHS = [
  'ai.apiKey',
  'search.apiKey',
  'hunter.apiKey',
  'email.resendKey',
  'email.webhookToken',
  'notify.telegram.token',
  'notify.whatsapp.token',
];

const COLLECTION_DEFAULTS = {
  settings: DEFAULT_SETTINGS,
  products: [],
  missions: [],
  threads: [],
  content: [],
  learnings: [],
  suppressions: [],
  activity: [],
  meta: {},
  telegramSessions: {},
  outbox: [],
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepClone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function deepMerge(base, patch) {
  if (Array.isArray(patch)) return deepClone(patch);
  if (!isObject(patch)) return patch === undefined ? deepClone(base) : patch;
  const out = isObject(base) ? deepClone(base) : {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (value === undefined) continue;
    out[key] = isObject(value) && isObject(out[key]) ? deepMerge(out[key], value) : deepClone(value);
  }
  return out;
}

function getPath(object, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), object);
}

function setPath(object, path, value) {
  const parts = path.split('.');
  let cursor = object;
  parts.slice(0, -1).forEach((key) => {
    if (!isObject(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[parts.at(-1)] = value;
}

export function isSecretPath(path) {
  return SECRET_PATHS.includes(path);
}

function mergeSettings(current, patch, prefix = '') {
  if (!isObject(patch)) return patch;
  const out = isObject(current) ? deepClone(current) : {};
  for (const [key, value] of Object.entries(patch)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (isSecretPath(path) && (value === '' || String(value).startsWith('”¢”¢'))) continue;
    if (value === null || value === undefined) continue;
    if (isObject(value) && isSecretPath(path) === false && (isObject(out[key]) || out[key] === undefined)) {
      out[key] = mergeSettings(out[key] || {}, value, path);
    } else {
      out[key] = deepClone(value);
    }
  }
  return out;
}

export function maskSettings(settings) {
  const out = deepClone(settings);
  for (const path of SECRET_PATHS) {
    const value = getPath(out, path);
    if (typeof value === 'string' && value) {
      setPath(out, path, `”¢”¢”¢”¢”¢”¢${value.slice(-4)}`);
    }
  }
  return out;
}

export function settingsFlags(settings) {
  // La disponibilidad real depende del proveedor: Ollama, Pollinations y los
  // servidores locales funcionan sin clave. Antes la interfaz decía "modo
  // demo" aunque la misión sí podía ejecutarse, y el dueño no entendía por qué
  // el botón real estaba deshabilitado.
  const aiReady = isAIReady(settings);
  return {
    ai: aiReady,
    aiProvider: settings.ai?.provider || '',
    search: settings.search?.provider === 'duckduckgo' || Boolean(settings.search?.apiKey),
    searchProvider: settings.search?.provider || 'duckduckgo',
    hunter: Boolean(settings.hunter?.apiKey),
    email: (settings.email?.provider === 'resend' && Boolean(settings.email?.resendKey))
      || (settings.email?.provider === 'gmail' && Boolean(settings.email?.smtpUser && settings.email?.smtpPassword)),
    telegram: Boolean(settings.notify?.telegram?.enabled && settings.notify?.telegram?.token && settings.notify?.telegram?.chatId),
    whatsapp: Boolean(settings.notify?.whatsapp?.enabled && settings.notify?.whatsapp?.token && settings.notify?.whatsapp?.phoneNumberId && settings.notify?.whatsapp?.to),
    demo: !aiReady,
  };
}

/* ─────────────────────────────────────────────────────────────
   Almacén en archivos JSON con escritura atómica y cola.
   ───────────────────────────────────────────────────────────── */

function applyEnvOverrides(settings) {
  const out = deepClone(settings);
  out.ai = out.ai || {};
  out.search = out.search || {};
  out.email = out.email || {};
  out.hunter = out.hunter || {};
  out.brand = out.brand || {};
  if (process.env.LUCIAN_AI_PROVIDER) out.ai.provider = process.env.LUCIAN_AI_PROVIDER;
  if (process.env.LUCIAN_AI_BASE_URL) out.ai.baseUrl = process.env.LUCIAN_AI_BASE_URL;
  if (process.env.LUCIAN_AI_MODEL) out.ai.model = process.env.LUCIAN_AI_MODEL;
  if (process.env.LUCIAN_AI_VISION_MODEL) out.ai.visionModel = process.env.LUCIAN_AI_VISION_MODEL;
  if (process.env.LUCIAN_AI_API_KEY) out.ai.apiKey = process.env.LUCIAN_AI_API_KEY;
  if (process.env.LUCIAN_SEARCH_PROVIDER) out.search.provider = process.env.LUCIAN_SEARCH_PROVIDER;
  if (process.env.LUCIAN_SEARCH_API_KEY) out.search.apiKey = process.env.LUCIAN_SEARCH_API_KEY;
  if (process.env.LUCIAN_SEARX_URL) out.search.searxUrl = process.env.LUCIAN_SEARX_URL;
  if (process.env.LUCIAN_RESEND_KEY) out.email.resendKey = process.env.LUCIAN_RESEND_KEY;
  if (process.env.LUCIAN_EMAIL_FROM) out.email.from = process.env.LUCIAN_EMAIL_FROM;
  if (process.env.LUCIAN_EMAIL_REPLY_TO) out.email.replyTo = process.env.LUCIAN_EMAIL_REPLY_TO;
  if (process.env.LUCIAN_WEBHOOK_TOKEN) out.email.webhookToken = process.env.LUCIAN_WEBHOOK_TOKEN;
  if (process.env.LUCIAN_HUNTER_API_KEY) out.hunter.apiKey = process.env.LUCIAN_HUNTER_API_KEY;
  if (process.env.LUCIAN_BRAND_NAME) out.brand.name = process.env.LUCIAN_BRAND_NAME;
  return out;
}

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.cache = new Map();
    this.writeChains = new Map();
    this.pendingWrites = new Map();
    this.ready = false;
  }

  async init() {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    this.fs = fs;
    this.path = path;
    this.mediaDir = path.join(this.dataDir, 'media');
    this.backupDir = path.join(this.dataDir, 'backups');
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.mediaDir, { recursive: true });
    await fs.mkdir(path.join(this.mediaDir, 'products'), { recursive: true });
    await fs.mkdir(path.join(this.mediaDir, 'demo'), { recursive: true });
    await fs.mkdir(this.backupDir, { recursive: true });

    for (const [name, fallback] of Object.entries(COLLECTION_DEFAULTS)) {
      const file = this.fileFor(name);
      try {
        const raw = await fs.readFile(file, 'utf8');
        const parsed = JSON.parse(raw);
        this.cache.set(name, name === 'settings' ? deepMerge(DEFAULT_SETTINGS, parsed) : parsed);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          // Un JSON roto no debe impedir arrancar: se conserva una copia y se usa el default.
          try {
            await fs.rename(file, `${file}.broken-${Date.now()}`);
          } catch { /* noop */ }
        }
        const initial = deepClone(fallback);
        if (name === 'meta') {
          initial.createdAt = nowISO();
          initial.lastDigest = null;
          initial.agentUsage = {};
          initial.telegramOffset = 0;
        }
        this.cache.set(name, initial);
        await this.write(name, initial);
      }
    }

    if (!this.cache.get('meta').createdAt) {
      this.cache.get('meta').createdAt = nowISO();
    }
    // Completar ajustes nuevos sin pisar los existentes.
    const merged = deepMerge(DEFAULT_SETTINGS, this.cache.get('settings') || {});
    // verifyToken por defecto adivinable ('lucian'): reemplazar por uno no trivial.
    const wa = merged?.notify?.whatsapp;
    let verifyTokenChanged = false;
    if (wa && (!wa.verifyToken || wa.verifyToken === 'lucian')) {
      wa.verifyToken = `lmb-${crypto.randomUUID().slice(0, 12)}`;
      verifyTokenChanged = true;
    }
    this.cache.set('settings', merged);
    if (verifyTokenChanged) {
      try { await this.write('settings', merged); } catch (error) { console.error('No se pudo persistir verifyToken de WhatsApp:', error?.message || error); }
    }
    this.ready = true;
    return this;
  }

  fileFor(name) {
    return this.path.join(this.dataDir, `${name}.json`);
  }

  get(name) {
    if (!this.cache.has(name)) {
      const fallback = COLLECTION_DEFAULTS[name];
      this.cache.set(name, deepClone(fallback ?? []));
    }
    return this.cache.get(name);
  }

  async set(name, value) {
    this.cache.set(name, value);
    return this.enqueueWrite(name, value);
  }

  enqueueWrite(name, value) {
    const previous = this.writeChains.get(name) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(() => this.write(name, value));
    this.writeChains.set(name, next);
    return next;
  }

  async write(name, value) {
    const file = this.fileFor(name);
    const tmp = `${file}.${uid('tmp')}.tmp`;
    const payload = JSON.stringify(value, null, 2);
    await this.fs.writeFile(tmp, payload, 'utf8');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await this.fs.rename(tmp, file);
        return;
      } catch (error) {
        if (attempt === 4) {
          try { await this.fs.rm(tmp, { force: true }); } catch { /* noop */ }
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
      }
    }
  }

  setDebounced(name, value, delayMs = 400) {
    this.cache.set(name, value);
    let pending = this.pendingWrites.get(name);
    if (pending) {
      pending.value = value;
      return new Promise((resolve) => pending.resolvers.push(resolve));
    }
    pending = { value, resolvers: [], timer: null };
    this.pendingWrites.set(name, pending);
    const promise = new Promise((resolve) => pending.resolvers.push(resolve));
    pending.timer = setTimeout(async () => {
      const entry = this.pendingWrites.get(name);
      if (!entry) return;
      this.pendingWrites.delete(name);
      try {
        await this.enqueueWrite(name, entry.value);
      } catch { /* noop */ }
      for (const resolve of entry.resolvers) try { resolve(); } catch { /* noop */ }
    }, Math.max(0, Number(delayMs) || 400));
    return promise;
  }

  async flushPending() {
    const names = [...this.pendingWrites.keys()];
    for (const name of names) {
      const entry = this.pendingWrites.get(name);
      if (!entry) continue;
      if (entry.timer) clearTimeout(entry.timer);
      this.pendingWrites.delete(name);
      try {
        await this.enqueueWrite(name, entry.value);
      } catch { /* noop */ }
      for (const resolve of entry.resolvers) try { resolve(); } catch { /* noop */ }
    }
  }

  async flush() {
    await this.flushPending();
  }

  find(name, id) {
    return this.get(name).find((item) => item.id === id) || null;
  }

  async insert(name, item) {
    const list = this.get(name);
    list.unshift(item);
    await this.set(name, list);
    return item;
  }

  async patch(name, id, patch) {
    const list = this.get(name);
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) return null;
    list[index] = { ...list[index], ...patch, updatedAt: nowISO() };
    await this.set(name, list);
    return list[index];
  }

  async remove(name, id) {
    const list = this.get(name);
    const next = list.filter((item) => item.id !== id);
    await this.set(name, next);
    return list.length !== next.length;
  }

  rawSettings() {
    return this.get('settings');
  }

  settings() {
    return applyEnvOverrides(deepMerge(DEFAULT_SETTINGS, this.get('settings') || {}));
  }

  async saveSettings(patch) {
    const merged = mergeSettings(this.get('settings') || {}, patch);
    // Validaciones suaves para no romper la app con valores absurdos.
    merged.mission = merged.mission || {};
    merged.mission.maxProspects = Math.max(1, Math.min(40, Number(merged.mission.maxProspects) || 12));
    merged.mission.depth = ['rapida', 'estandar', 'profunda'].includes(merged.mission.depth) ? merged.mission.depth : 'estandar';
    merged.mission.reviewDirectory = merged.mission.reviewDirectory !== false;
    merged.email = merged.email || {};
    merged.email.dailyLimit = Math.max(1, Math.min(200, Number(merged.email.dailyLimit) || 20));
    merged.ai = merged.ai || {};
    merged.ai.temperature = Math.max(0, Math.min(1.2, Number(merged.ai.temperature) || 0.6));
    merged.ai.maxTokens = Math.max(512, Math.min(16000, Number(merged.ai.maxTokens) || 8192));
    await this.set('settings', merged);
    return merged;
  }

  async clearSecret(path) {
    if (!isSecretPath(path)) throw new Error('Ruta de secreto no permitida');
    const settings = deepClone(this.get('settings') || {});
    setPath(settings, path, '');
    await this.set('settings', settings);
    return settings;
  }

  async activity(type, text, meta = {}) {
    const list = this.get('activity');
    const entry = { id: uid('act'), type, text, meta, at: nowISO() };
    list.unshift(entry);
    if (list.length > 500) list.length = 500;
    this.enqueueWrite('activity', list);
    return entry;
  }

  async saveMedia(buffer, ext, subdir = 'products', alt = '') {
    const dir = this.path.join(this.mediaDir, subdir);
    await this.fs.mkdir(dir, { recursive: true });
    const cleanExt = String(ext || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const name = `${uid('img')}.${cleanExt}`;
    await this.fs.writeFile(this.path.join(dir, name), buffer);
    return { file: `${subdir}/${name}`, alt };
  }

  mediaPath(rel) {
    const normalized = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (normalized.includes('..')) return null;
    const full = this.path.resolve(this.mediaDir, normalized);
    if (!full.startsWith(this.path.resolve(this.mediaDir))) return null;
    return full;
  }

  async removeMedia(rel) {
    const full = this.mediaPath(rel);
    if (!full) return;
    try { await this.fs.rm(full, { force: true }); } catch { /* noop */ }
  }

  async setMeta(patch) {
    const meta = { ...this.get('meta'), ...patch };
    await this.set('meta', meta);
    return meta;
  }

  async trackAgent(agentId) {
    const meta = { ...this.get('meta') };
    meta.agentUsage = meta.agentUsage || {};
    meta.agentUsage[agentId] = (meta.agentUsage[agentId] || 0) + 1;
    await this.set('meta', meta);
  }

  exportBundle() {
    return {
      app: 'lucian',
      version: 1,
      exportedAt: nowISO(),
      data: Object.fromEntries(Object.keys(COLLECTION_DEFAULTS).map((name) => [name, deepClone(this.get(name))])),
    };
  }

  async importBundle(bundle) {
    if (!bundle || bundle.app !== 'lucian' || !isObject(bundle.data)) {
      throw new Error('El archivo no es una copia de seguridad válida de Lucian.');
    }
    for (const name of Object.keys(COLLECTION_DEFAULTS)) {
      if (!(name in bundle.data)) continue;
      const value = bundle.data[name];
      if (name === 'settings') {
        const merged = deepMerge(DEFAULT_SETTINGS, value);
        await this.set(name, merged);
      } else if (Array.isArray(value)) {
        await this.set(name, value);
      } else if (isObject(value)) {
        await this.set(name, value);
      }
    }
    await this.activity('system', 'Se restauró una copia de seguridad.');
  }
}
