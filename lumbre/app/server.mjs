import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const PORT = 3210;
const AIRTABLE = 'https://api.airtable.com/v0';
const REQUIRED_TABLES = ['Productos', 'Leads', 'Outbox', 'Conversaciones', 'Contenido', 'Config', 'Metricas', 'Aprendizajes'];

const DEFAULT_CONFIG = {
  airtableToken: '',
  baseId: '',
  baseName: '',
  tables: {},
  make: {
    token: '',
    teamId: '',
    zone: 'us2',
    scenarios: { sales: '', send: '', replies: '', marketing: '' }
  }
};

let config = await loadConfig();
const schemaCache = new Map();
let lastCall = 0;

const configSeed = [
  ['marca', 'COMPLETAR: nombre de tu marca'],
  ['web', 'COMPLETAR: URL de tu web o Instagram'],
  ['email_remitente', 'COMPLETAR: email desde el que envias'],
  ['firma', 'COMPLETAR: nombre, cargo, telefono y web'],
  ['direccion_fisica', 'COMPLETAR: direccion postal para la firma (obligatoria para CAN-SPAM)'],
  ['pais_base', 'Argentina'],
  ['moneda_base', 'USD'],
  ['idiomas', 'es,en,pt'],
  ['modo_envio', 'manual'],
  ['limite_borradores_por_ciclo', '3'],
  ['limite_envios_por_dia', '15'],
  ['limite_seguimientos', '2'],
  ['dias_entre_seguimientos', '4'],
  ['nichos_prioritarios', 'estudios de interiorismo, arquitectura, hoteles boutique, restaurantes de diseno, coworkings premium, regalos corporativos'],
  ['paises_prioritarios', 'Argentina, Chile, Uruguay, Mexico, Espana, Estados Unidos'],
  ['propuesta_valor', 'COMPLETAR: que hace unica a tu lampara (material, diseno, personalizacion, plazo)'],
  ['publico_prioritario', 'interioristas, arquitectos, hoteles, restaurantes, retail de diseno y regalos corporativos'],
  ['no_afirmar', 'No inventar certificaciones, clientes, stock, plazos ni precios. No prometer envios internacionales sin confirmar logistica.'],
  ['horario_reporte', '09:00 America/Argentina/Buenos_Aires'],
  ['aprobacion', 'El dueno aprueba cada correo en la app antes del envio.'],
  ['version_sistema', '1.0']
];

async function loadConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      make: {
        ...DEFAULT_CONFIG.make,
        ...(parsed.make || {}),
        scenarios: { ...DEFAULT_CONFIG.make.scenarios, ...((parsed.make || {}).scenarios || {}) }
      }
    };
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

async function saveConfig(next) {
  config = {
    ...DEFAULT_CONFIG,
    ...next,
    make: {
      ...DEFAULT_CONFIG.make,
      ...(next.make || {}),
      scenarios: { ...DEFAULT_CONFIG.make.scenarios, ...((next.make || {}).scenarios || {}) }
    }
  };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function requireConfig() {
  if (!config.airtableToken || !config.baseId) throw new Error('La app todavia no esta conectada a Airtable.');
}

async function rateLimit() {
  const wait = Math.max(0, 240 - (Date.now() - lastCall));
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
}

async function airtableRequest(pathname, token, options = {}) {
  await rateLimit();
  const response = await fetch(`${AIRTABLE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.error?.message || data.error || text || response.statusText;
    const details = data.error?.details ? ` ${JSON.stringify(data.error.details)}` : '';
    const error = new Error(`${response.status} ${message}${details}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function whoami(token) {
  return airtableRequest('/meta/whoami', token);
}

async function listBases(token) {
  const data = await airtableRequest('/meta/bases', token);
  return data.bases || [];
}

async function getSchema(token, baseId) {
  const cacheKey = `${baseId}`;
  if (schemaCache.has(cacheKey)) return schemaCache.get(cacheKey);
  const data = await airtableRequest(`/meta/bases/${baseId}/tables`, token);
  schemaCache.set(cacheKey, data);
  return data;
}

async function listRecords(table, token, params = {}) {
  const url = new URL(`${AIRTABLE}/${config.baseId}/${encodeURIComponent(table)}`);
  if (params.filterByFormula) url.searchParams.set('filterByFormula', params.filterByFormula);
  if (params.maxRecords) url.searchParams.set('maxRecords', String(params.maxRecords));
  if (params.offset) url.searchParams.set('offset', params.offset);
  const data = await airtableRequest(`${url.pathname}${url.search}`, token);
  return data;
}

async function getAllRecords(table, token, cap = 200) {
  const records = [];
  let offset;
  do {
    const data = await listRecords(table, token, {
      maxRecords: Math.min(100, cap - records.length),
      offset
    });
    records.push(...data.records);
    offset = data.offset;
  } while (offset && records.length < cap);
  return records.slice(0, cap);
}

async function createRecords(table, token, records) {
  const output = [];
  for (let i = 0; i < records.length; i += 10) {
    const data = await airtableRequest(`/${config.baseId}/${encodeURIComponent(table)}`, token, {
      method: 'POST',
      body: JSON.stringify({ records: records.slice(i, i + 10) })
    });
    output.push(...data.records);
  }
  return output;
}

async function updateRecords(table, token, records) {
  const output = [];
  for (let i = 0; i < records.length; i += 10) {
    const data = await airtableRequest(`/${config.baseId}/${encodeURIComponent(table)}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ records: records.slice(i, i + 10) })
    });
    output.push(...data.records);
  }
  return output;
}

async function uploadAttachment(recordId, fieldId, token, file) {
  const response = await fetch(`https://content.airtable.com/v0/${config.baseId}/${recordId}/${encodeURIComponent(fieldId)}/uploadAttachment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contentType: file.contentType, file: file.data })
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.error?.message || data.error || text || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }
  return data;
}

async function getPhotosFieldId(token) {
  const schema = await getSchema(token, config.baseId);
  const table = schema.tables.find((item) => item.name === 'Productos');
  const field = table?.fields.find((item) => item.name === 'Fotos');
  return field?.id || 'Fotos';
}

function normalizeRecord(record) {
  return { id: record.id, ...record.fields };
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

async function readJson(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('La foto es demasiado grande (maximo 8 MB por foto).'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON invalido.'));
      }
    });
    req.on('error', reject);
  });
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

async function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.join(PUBLIC, relative);
  if (!filePath.startsWith(PUBLIC)) {
    json(res, 403, { error: 'Ruta no permitida.' });
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  } catch {
    json(res, 404, { error: 'No encontrado.' });
  }
}

async function seedConfigRows(token) {
  const existing = await getAllRecords('Config', token, 200);
  const present = new Set(existing.map((record) => String(record.fields.Clave || '').toLowerCase()));
  const missing = configSeed.filter(([key]) => !present.has(key.toLowerCase()));
  if (!missing.length) return { created: 0, total: configSeed.length };
  const records = missing.map(([Clave, Valor]) => ({ fields: { Clave, Valor } }));
  await createRecords('Config', token, records);
  return { created: records.length, total: configSeed.length };
}

async function runMake(role) {
  const make = config.make || {};
  const scenarioId = make.scenarios?.[role];
  if (!make.token || !make.teamId || !scenarioId) {
    throw new Error('Falta conectar Make o mapear el escenario de este rol.');
  }
  const zone = make.zone || 'us2';
  const response = await fetch(`https://${zone}.make.com/api/v2/scenarios/${scenarioId}/run`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${make.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ responsive: false })
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.message || data.error?.message || data.error || text || response.statusText;
    throw new Error(`${response.status} ${message}`);
  }
  return data;
}

async function handleApi(req, res, url) {
  const method = req.method;
  const route = url.pathname;

  if (method === 'GET' && route === '/api/health') {
    const make = config.make || {};
    const makeConfigured = Boolean(make.token && make.teamId && make.scenarios?.sales && make.scenarios?.send && make.scenarios?.replies && make.scenarios?.marketing);
    json(res, 200, {
      configured: Boolean(config.airtableToken && config.baseId),
      baseName: config.baseName || '',
      baseId: config.baseId || '',
      tables: config.tables || {},
      makeConfigured,
      makeScenarios: make.scenarios || {}
    });
    return;
  }

  if (method === 'POST' && route === '/api/connect') {
    const body = await readJson(req);
    if (!body.token || !body.token.startsWith('pat')) throw new Error('Pega un token valido de Airtable (empieza con pat).');
    await whoami(body.token);
    const bases = await listBases(body.token);
    json(res, 200, { bases });
    return;
  }

  if (method === 'POST' && route === '/api/connect-base') {
    const body = await readJson(req);
    if (!body.token || !body.baseId) throw new Error('Falta el token o la base.');
    const schema = await getSchema(body.token, body.baseId);
    const tables = Object.fromEntries((schema.tables || []).map((table) => [table.name, table.id]));
    const missing = REQUIRED_TABLES.filter((name) => !tables[name]);
    if (missing.length) {
      json(res, 200, { ok: false, missing, tables });
      return;
    }
    const bases = await listBases(body.token);
    const baseName = bases.find((base) => base.id === body.baseId)?.name || 'Base de Airtable';
    schemaCache.set(body.baseId, schema);
    await saveConfig({
      ...config,
      airtableToken: body.token,
      baseId: body.baseId,
      baseName,
      tables
    });
    json(res, 200, { ok: true, baseName, tables });
    return;
  }

  if (method === 'POST' && route === '/api/seed-config') {
    requireConfig();
    const result = await seedConfigRows(config.airtableToken);
    json(res, 200, result);
    return;
  }

  if (method === 'GET' && route === '/api/config') {
    requireConfig();
    const records = await getAllRecords('Config', config.airtableToken, 200);
    json(res, 200, records.map(normalizeRecord));
    return;
  }

  if (method === 'PATCH' && route.startsWith('/api/config/')) {
    requireConfig();
    const id = decodeURIComponent(route.slice('/api/config/'.length));
    const body = await readJson(req);
    await updateRecords('Config', config.airtableToken, [{ id, fields: body.fields || {} }]);
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'GET' && route === '/api/products') {
    requireConfig();
    const records = await getAllRecords('Productos', config.airtableToken, 200);
    json(res, 200, records.map(normalizeRecord));
    return;
  }

  if (method === 'POST' && route === '/api/products') {
    requireConfig();
    const body = await readJson(req);
    const fields = body.fields || {};
    const photos = Array.isArray(body.photos) ? body.photos : [];
    const created = await createRecords('Productos', config.airtableToken, [{ fields }]);
    const record = created[0];
    let warnings = [];
    if (photos.length) {
      const fieldId = await getPhotosFieldId(config.airtableToken);
      for (const photo of photos) {
        try {
          await uploadAttachment(record.id, fieldId, config.airtableToken, photo);
        } catch (error) {
          warnings.push(error.message);
        }
      }
    }
    json(res, 200, { record: normalizeRecord(record), warnings });
    return;
  }

  if (method === 'PATCH' && route.startsWith('/api/products/')) {
    requireConfig();
    const id = decodeURIComponent(route.slice('/api/products/'.length));
    const body = await readJson(req);
    const photos = Array.isArray(body.photos) ? body.photos : [];
    await updateRecords('Productos', config.airtableToken, [{ id, fields: body.fields || {} }]);
    let warnings = [];
    if (photos.length) {
      const fieldId = await getPhotosFieldId(config.airtableToken);
      for (const photo of photos) {
        try {
          await uploadAttachment(id, fieldId, config.airtableToken, photo);
        } catch (error) {
          warnings.push(error.message);
        }
      }
    }
    json(res, 200, { ok: true, warnings });
    return;
  }

  const simpleTables = {
    '/api/leads': 'Leads',
    '/api/outbox': 'Outbox',
    '/api/conversations': 'Conversaciones',
    '/api/content': 'Contenido',
    '/api/metrics': 'Metricas'
  };

  if (method === 'GET' && simpleTables[route]) {
    requireConfig();
    const records = await getAllRecords(simpleTables[route], config.airtableToken, 200);
    json(res, 200, records.map(normalizeRecord));
    return;
  }

  for (const [prefix, table] of Object.entries({
    '/api/leads/': 'Leads',
    '/api/outbox/': 'Outbox',
    '/api/conversations/': 'Conversaciones',
    '/api/content/': 'Contenido',
    '/api/metrics/': 'Metricas'
  })) {
    if (method === 'PATCH' && route.startsWith(prefix)) {
      requireConfig();
      const id = decodeURIComponent(route.slice(prefix.length));
      const body = await readJson(req);
      await updateRecords(table, config.airtableToken, [{ id, fields: body.fields || {} }]);
      json(res, 200, { ok: true });
      return;
    }
  }

  if (method === 'POST' && route === '/api/disconnect') {
    schemaCache.clear();
    await saveConfig(structuredClone(DEFAULT_CONFIG));
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && route === '/api/make/connect') {
    const body = await readJson(req);
    if (!body.token || !body.teamId) throw new Error('Falta el token de Make o el team ID.');
    const zone = body.zone || 'us2';
    const response = await fetch(`https://${zone}.make.com/api/v2/scenarios?teamId=${encodeURIComponent(body.teamId)}`, {
      headers: { Authorization: `Token ${body.token}` }
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const message = data.message || data.error?.message || data.error || text || response.statusText;
      throw new Error(`${response.status} ${message}`);
    }
    await saveConfig({
      ...config,
      make: { ...config.make, token: body.token, teamId: body.teamId, zone }
    });
    json(res, 200, { scenarios: data.scenarios || [] });
    return;
  }

  if (method === 'POST' && route === '/api/make/map') {
    const body = await readJson(req);
    await saveConfig({
      ...config,
      make: {
        ...config.make,
        scenarios: {
          sales: body.sales || '',
          send: body.send || '',
          replies: body.replies || '',
          marketing: body.marketing || ''
        }
      }
    });
    json(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && route.startsWith('/api/run/')) {
    const role = route.slice('/api/run/'.length);
    if (!['sales', 'send', 'replies', 'marketing'].includes(role)) throw new Error('Rol invalido.');
    const result = await runMake(role);
    json(res, 200, { ok: true, result });
    return;
  }

  json(res, 404, { error: 'Ruta no encontrada.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    if (req.method !== 'GET') {
      json(res, 405, { error: 'Metodo no permitido.' });
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, error.status || 500, { error: error.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  Sistema de Ventas listo.');
  console.log(`  Abri: http://localhost:${PORT}`);
  console.log('  Deja esta ventana abierta. Minimizala, no la cierres.');
  console.log('');
  const open = process.platform === 'win32'
    ? `start "" http://localhost:${PORT}`
    : process.platform === 'darwin'
      ? `open http://localhost:${PORT}`
      : `xdg-open http://localhost:${PORT}`;
  exec(open);
});