import dns from 'node:dns/promises';
import net from 'node:net';
import crypto from 'node:crypto';

/* ─────────────────────────────────────────────────────────────
   Identidad, tiempo y números
   ───────────────────────────────────────────────────────────── */

export function uid(prefix = '') {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return prefix ? `${prefix}_${raw}` : raw;
}

export function nowISO() {
  return new Date().toISOString();
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function localDayKey(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function asNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function asString(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

export function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function slugify(text, fallback = 'item') {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || fallback;
}

export function truncate(text, max = 600) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function uniqueBy(list, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of asArray(list)) {
    const key = keyFn(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────
   JSON tolerante (los modelos a veces devuelven casi-JSON)
   ───────────────────────────────────────────────────────────── */

export function extractJson(text) {
  if (typeof text !== 'string') return null;
  let raw = text.trim().replace(/^\uFEFF/, '');
  if (!raw) return null;
  // Modelos tipo Qwen envuelven el razonamiento en <think>...</think> antes
  // del JSON: se descarta para no romper el parseo.
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const fenced = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced) raw = fenced[1].trim();

  const direct = tryParse(raw);
  if (direct !== undefined) return direct;

  const firstObj = raw.indexOf('{');
  const firstArr = raw.indexOf('[');
  let start = -1;
  if (firstObj === -1) start = firstArr;
  else if (firstArr === -1) start = firstObj;
  else start = Math.min(firstObj, firstArr);

  if (start === -1) return null;

  const open = raw[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        const candidate = raw.slice(start, i + 1);
        const parsed = tryParse(candidate);
        if (parsed !== undefined) return parsed;
        const repaired = tryParse(repairJson(candidate));
        if (repaired !== undefined) return repaired;
        break;
      }
    }
  }

  const repairedWhole = tryParse(repairJson(raw));
  return repairedWhole === undefined ? null : repairedWhole;
}

function tryParse(text) {
  try { return JSON.parse(text); } catch { return undefined; }
}

export function repairJson(text) {
  let s = String(text);
  // Caracteres de control ilegales dentro del texto.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  // Comas finales.
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Comillas tipográficas usadas como delimitadores.
  s = s.replace(/[\u201C\u201D]/g, '"');
  // Comentarios de una línea al inicio de línea (fuera de strings es difícil; solo casos claros).
  s = s.replace(/^\s*\/\/.*$/gm, '');
  // Valores tipo `NaN` / `Infinity`.
  s = s.replace(/:\s*NaN\b/g, ': null').replace(/:\s*-?Infinity\b/g, ': null');
  return s.trim();
}

/* ─────────────────────────────────────────────────────────────
   HTML → texto, entidades y emails
   ───────────────────────────────────────────────────────────── */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  iexcl: '¡', iquest: '¿', ntilde: 'ñ', Ntilde: 'Ñ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', bull: '•', middot: '·',
  deg: '°', euro: '€', pound: '£', yen: '¥', dollar: '$', copy: '©', reg: '®', trade: '™',
};

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, code) => {
    if (code[0] === '#') {
      const hex = code[1] === 'x' || code[1] === 'X';
      const num = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (Number.isFinite(num) && num > 0 && num <= 0x10ffff) {
        try { return String.fromCodePoint(num); } catch { return match; }
      }
      return match;
    }
    return ENTITIES[code] ?? ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function stripTags(html) {
  return decodeEntities(String(html ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function htmlToText(html) {
  let s = String(html ?? '');
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');

  s = decodeEntities(s)
    .replace(/\r/g, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s;
}

export function extractTitle(html) {
  const og = String(html ?? '').match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]).trim();
  const title = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripTags(title[1]).slice(0, 160) : '';
}

const EXAMPLE_EMAIL_DOMAIN = /(^|\.)example\.(com|org|net)$/i;

export function extractEmails(text) {
  const found = String(text ?? '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(found
    .map((e) => e.toLowerCase().replace(/\.$/, ''))
    .filter((e) => !/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(e))
    // Un email de ejemplo nunca es un contacto real: no debe entrar al flujo.
    .filter((e) => !EXAMPLE_EMAIL_DOMAIN.test(e.split('@')[1] || '')))];
}

export function normalizeDomain(input) {
  try {
    const raw = String(input || '').trim();
    if (!raw) return '';
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

export function cleanWebsite(input) {
  try {
    const raw = String(input || '').trim();
    if (!raw) return '';
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

/* ─────────────────────────────────────────────────────────────
   HTTP seguro (evita SSRF y páginas gigantes)
   ───────────────────────────────────────────────────────────── */

const PRIVATE_V4 = [
  [/^0\./, 'red 0.0.0.0/8'],
  [/^10\./, 'red privada'],
  [/^127\./, 'loopback'],
  [/^169\.254\./, 'link-local'],
  [/^172\.(1[6-9]|2\d|3[01])\./, 'red privada'],
  [/^192\.168\./, 'red privada'],
  [/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, 'CGNAT'],
  [/^192\.0\.0\./, 'reservada'],
  [/^192\.0\.2\./, 'documentación'],
  [/^198\.18\./, 'benchmark'],
  [/^198\.51\.100\./, 'documentación'],
  [/^203\.0\.113\./, 'documentación'],
  [/^(22[4-9]|2[3-5]\d)\./, 'multicast'],
];

function isPrivateIp(address) {
  const family = net.isIP(address);
  if (family === 4) {
    if (PRIVATE_V4.some(([re]) => re.test(address))) return true;
    const [a, b] = address.split('.').map(Number);
    return a >= 240 || (a === 255) || (a === 192 && b === 0);
  }
  if (family === 6) {
    const low = address.toLowerCase();
    if (low === '::1' || low === '::' || low.startsWith('fc') || low.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(low) || low.startsWith('ff')) return true;
    if (low.startsWith('::ffff:')) return isPrivateIp(low.slice(7));
    if (low.startsWith('2001:db8')) return true;
    return false;
  }
  return true;
}

export async function assertPublicHttpUrl(input) {
  let url;
  try {
    url = new URL(String(input));
  } catch {
    throw new Error('URL inválida');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Solo se permiten enlaces http/https');
  if (url.username || url.password) throw new Error('URL con credenciales no permitida');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Destino local bloqueado');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Dirección privada bloqueada');
    return url;
  }
  let records = [];
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`No se pudo resolver ${host}`);
  }
  if (!records.length || records.some((r) => isPrivateIp(r.address))) {
    throw new Error('El dominio apunta a una dirección privada');
  }
  return url;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response, maxBytes) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let received = 0;
  let out = '';
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    try { await reader.cancel(); } catch { /* noop */ }
  }
  out += decoder.decode();
  return out;
}

export async function safeFetchText(input, { maxBytes = 1_500_000, timeoutMs = 14000, headers = {} } = {}) {
  let current = String(input);
  for (let hop = 0; hop < 4; hop += 1) {
    const url = await assertPublicHttpUrl(current);
    const response = await fetchWithTimeout(url.toString(), {
      redirect: 'manual',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 LumbreResearch/1.0',
        'accept': 'text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
        ...headers,
      },
    }, timeoutMs);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirección sin destino');
      current = new URL(location, url).toString();
      continue;
    }
    if (!response.ok) throw new Error(`El sitio respondió ${response.status}`);

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const allowed = /text\/html|text\/plain|application\/json|application\/ld\+json|application\/xml|text\/xml|application\/xhtml/.test(contentType);
    if (contentType && !allowed) throw new Error('El enlace no es una página de texto');

    const text = await readCapped(response, maxBytes);
    return {
      text,
      title: extractTitle(text),
      contentType,
      status: response.status,
      finalUrl: url.toString(),
    };
  }
  throw new Error('Demasiadas redirecciones');
}

export async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 30000 } = {}) {
  const response = await fetchWithTimeout(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, timeoutMs);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { ok: response.ok, status: response.status, data, text };
}

/* ─────────────────────────────────────────────────────────────
   Secretos, CSV y otros
   ───────────────────────────────────────────────────────────── */

export function maskSecret(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 6) return '••••••';
  return `••••••${s.slice(-4)}`;
}

export function isMaskedSecret(value) {
  return typeof value === 'string' && value.startsWith('••');
}

export function maskEmail(value) {
  const s = String(value || '');
  const [user, domain] = s.split('@');
  if (!domain) return s;
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(2, user.length - 2))}@${domain}`;
}

export function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  const head = columns.map((c) => csvEscape(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c.key] ?? '')).join(','));
  return `\uFEFF${[head, ...body].join('\r\n')}`;
}

export function csvToObjects(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = String(text ?? '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',' || ch === ';') { row.push(field); field = ''; }
    else if (ch === '\n') {
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map((h) => h.trim());
  return rows.map((cells) => Object.fromEntries(headers.map((h, idx) => [h, (cells[idx] || '').trim()])));
}

export function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (buffer.slice(0, 3).toString('ascii') === 'GIF') return { ext: 'gif', mime: 'image/gif' };
  return null;
}

export function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  if (!match) throw new Error('Imagen inválida');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 8 * 1024 * 1024) throw new Error('Cada foto debe pesar menos de 8 MB');
  return { buffer, declaredMime: match[1].toLowerCase() };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function humanError(error) {
  const message = error?.message || String(error || 'Error desconocido');
  if (/cortó la respuesta por el límite de tokens|cortó por el límite de tokens/i.test(message)) {
    return 'El modelo se quedó sin espacio y cortó la respuesta. Subí "Máximo de tokens por respuesta" en Ajustes → IA (8000 o más) y reintentá.';
  }
  if (/no devolvió JSON válido/i.test(message)) {
    return 'El modelo no devolvió el formato esperado. Reintentá la misión; si vuelve a fallar, probá otro modelo.';
  }
  if (/401|unauthorized|invalid api key|incorrect api key/i.test(message)) return 'La clave de IA fue rechazada. Revisá que esté completa y activa.';
  if (/FREE_LIMIT|free limit|rate limit|429|quota/i.test(message)) return 'El proveedor de IA está limitando las consultas (cuota gratuita agotada o demasiadas seguidas). Esperá un minuto o configurá un proveedor con clave.';
  if (/402|insufficient|balance|crédito|credito/i.test(message)) return 'El proveedor de IA no tiene saldo suficiente. Cargá crédito o cambiá de proveedor.';
  if (/404|not found/i.test(message)) return 'El modelo o la dirección del proveedor no existe. Revisá base URL y nombre del modelo.';
  if (/timeout|aborted|ETIMEDOUT/i.test(message)) return 'La consulta tardó demasiado. Puede ser mala conexión o un proveedor lento.';
  if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(message)) return 'No hay conexión con el proveedor. Revisá internet o la dirección configurada.';
  return message.slice(0, 500);
}

export function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}
