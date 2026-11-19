import {
  decodeEntities, fetchJson, fetchWithTimeout, htmlToText, normalizeDomain, safeFetchText,
  stripTags, truncate, uniqueBy,
} from './util.mjs';

/* ─────────────────────────────────────────────────────────────
   Búsqueda web.

   Hay dos caminos:
   1. Proveedores con clave (Tavily, Brave, Serper): estables y pagos.
   2. Búsqueda sin clave: instancias públicas de SearXNG y, como
      último recurso, DuckDuckGo. DuckDuckGo bloquea consultas
      automáticas desde muchas redes (devuelve una verificación
      anti-bots en vez de resultados), así que no se puede usar
      como único motor: cuando falla hay que decirlo, nunca
      devolver una lista vacía como si la búsqueda hubiera
      funcionado.
   ───────────────────────────────────────────────────────────── */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Lumbre/1.0';
const PAGE_LIMIT_BYTES = 1_500_000;

/* Instancias públicas de SearXNG verificadas desde este equipo.
   Ninguna es de confianza especial: se usan solo para leer resultados
   públicos y se descartan si fallan. El dueño puede fijar una propia
   en Ajustes → Búsqueda (settings.search.searxUrl). */
export const SEARX_POOL = [
  'https://www.isci.si',
  'https://searx.dresden.network',
  'https://searxng.website',
  'https://shrt.win',
  'https://kantan.cat',
  'https://paulgo.io',
  'https://opnxng.com',
  'https://etsi.me',
  'https://searxng.deggo.fyi',
  'https://search.yuri.llc',
];

const QUERY_CACHE_TTL_MS = 20 * 60 * 1000;
const SEARX_WINDOW_MS = 15 * 60 * 1000;
const SEARX_MAX_QUERIES_PER_WINDOW = 4;
const SEARX_FAIL_COOLDOWN_MS = 90 * 1000;
const SEARX_HARD_FAIL_COOLDOWN_MS = 6 * 60 * 1000;
const SEARX_ATTEMPTS_PER_QUERY = 5;
const SEARX_DISCOVERY_TTL_MS = 6 * 60 * 60 * 1000;

const searxState = new Map();
const queryCache = new Map();
const discoveredPool = { at: 0, instances: [] };

function searchCacheKey(provider, query, custom = '') {
  return `${provider}|${custom}|${String(query).toLowerCase().slice(0, 260)}`;
}

export function clearSearchCache() {
  queryCache.clear();
  searxState.clear();
}

export function searchProviderInfo(settings) {
  const provider = settings?.search?.provider || 'duckduckgo';
  const labels = {
    duckduckgo: 'Búsqueda web sin clave (SearXNG)',
    tavily: 'Tavily',
    brave: 'Brave Search',
    serper: 'Serper (Google)',
    none: 'Sin búsqueda',
  };
  return {
    provider,
    label: labels[provider] || provider,
    ready: provider === 'duckduckgo' || provider === 'none' || Boolean(settings?.search?.apiKey),
  };
}

function cleanQuery(query) {
  return String(query || '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function normalizeResult(item) {
  const url = String(item?.url || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  return {
    title: stripTags(item.title || '').slice(0, 200),
    url,
    snippet: truncate(stripTags(item.snippet || ''), 500),
    provider: item.provider || 'web',
    engine: item.engine || item.provider || 'web',
  };
}

/* Palabras de categoría que aparecen en cualquier consulta de tiendas: si el
   único parecido con la consulta es "tiendas" o "iluminación", el resultado
   no es una fuente útil (pasa con anuncios y directorios de otro país). */
const GENERIC_RELEVANCE_TOKENS = new Set([
  'tienda', 'tiendas', 'shop', 'shops', 'store', 'stores', 'diseno', 'disenos', 'design', 'designer',
  'designers', 'iluminacion', 'lampara', 'lamparas', 'lamp', 'lamps', 'lighting', 'light', 'lights',
  'showroom', 'showrooms', 'interiorismo', 'interior', 'decoracion', 'decor', 'concept', 'precio',
  'precios', 'price', 'prices', 'mejores', 'mejor', 'best', 'top', 'guia', 'guide', 'wholesale',
  'buyer', 'buyers', 'distribuidor', 'distribuidores', 'dealer', 'dealers', 'fabricante',
  'fabricantes', 'manufacturer', 'marca', 'marcas', 'brand', 'brands', 'muebles', 'furniture',
  'hogar', 'home', 'import', 'imports', 'duty', 'duties', 'fixtures', 'trends', 'trend', 'series',
  'handmade', 'small', 'retail', 'nuevo', 'nueva', 'new',
]);

/* Los motores públicos devuelven basura cuando no entienden la consulta
   (spam, definiciones, resultados de otro idioma). Antes de pasarla al
   modelo, cada resultado tiene que compartir las palabras que identifican
   la consulta (ciudad, material, nombre); si no, no es una fuente. */
function relevantTokens(query) {
  return [...new Set(String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !/^\d+$/.test(token)))];
}

export function filterRelevantResults(query, results, { strict = false } = {}) {
  const tokens = relevantTokens(query);
  if (!tokens.length) return results;
  const significant = tokens.filter((token) => !GENERIC_RELEVANCE_TOKENS.has(token));
  const pool = strict && significant.length ? significant : tokens;
  const needed = Math.min(2, pool.length);
  return (results || []).filter((item) => {
    const haystack = `${item.title || ''} ${item.snippet || ''} ${item.url || ''}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ');
    const matches = pool.filter((token) => haystack.includes(token)).length;
    return matches >= needed;
  });
}

/* ─────────────────────────────────────────────────────────────
   HTTP de búsqueda (sin la guarda SSRF: los destinos son motores
   públicos o una instancia que el dueño configuró a mano).
   ───────────────────────────────────────────────────────────── */

async function fetchSearchPage(url, { timeoutMs = 12000 } = {}) {
  const response = await fetchWithTimeout(url, {
    redirect: 'follow',
    headers: {
      'user-agent': USER_AGENT,
      'accept': 'text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8',
      'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
    },
  }, timeoutMs);
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > PAGE_LIMIT_BYTES) throw new Error('La página de búsqueda es demasiado grande');
  const text = (await response.text()).slice(0, PAGE_LIMIT_BYTES);
  if (!response.ok) {
    const error = new Error(`El motor respondió ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return { text, status: response.status, finalUrl: response.url };
}

/* ─────────────────────────────────────────────────────────────
   Parsers
   ───────────────────────────────────────────────────────────── */

export function parseSearxngResults(html, limit = 8) {
  const results = [];
  const articles = String(html || '').match(/<article\b[^>]*>[\s\S]*?<\/article>/gi) || [];
  for (const article of articles) {
    const titleMatch = article.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const hrefMatch = titleMatch || article.match(/<a[^>]+class="[^"]*url_header[^"]*"[^>]*href="([^"]+)"/i);
    if (!hrefMatch) continue;
    const url = decodeEntities(hrefMatch[1]).trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const title = titleMatch
      ? stripTags(titleMatch[2]).slice(0, 200)
      : stripTags(url).slice(0, 200);
    const snippetMatch = article.match(/<p[^>]+class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const enginesMatch = article.match(/<div[^>]+class="[^"]*engines[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const engineMatch = enginesMatch?.[1]?.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
    results.push({
      title,
      url,
      snippet: snippetMatch ? truncate(stripTags(snippetMatch[1]), 500) : '',
      provider: 'searxng',
      engine: engineMatch ? truncate(stripTags(engineMatch[1]), 40) : 'searxng',
    });
    if (results.length >= limit) break;
  }
  return uniqueBy(results, (item) => item.url);
}

function cleanDdgUrl(href) {
  let url = decodeEntities(String(href || '').trim());
  if (url.startsWith('//')) url = `https:${url}`;
  try {
    const parsed = new URL(url);
    if (/(^|\.)duckduckgo\.com$/.test(parsed.hostname) && parsed.pathname.startsWith('/l/')) {
      const target = parsed.searchParams.get('uddg');
      if (target) return decodeURIComponent(target);
    }
  } catch { return ''; }
  return url;
}

export function parseDuckDuckGo(html, limit = 8) {
  const results = [];
  const blocks = String(html).split(/<div[^>]+class="[^"]*result__body[^"]*"/i).slice(1);
  for (const block of blocks) {
    const link = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = cleanDdgUrl(link[1]);
    if (!url || !/^https?:/i.test(url)) continue;
    const snippet = block.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div|td)>/i);
    results.push({
      title: stripTags(link[2]).slice(0, 180),
      url,
      snippet: snippet ? truncate(stripTags(snippet[1]), 500) : '',
      provider: 'duckduckgo',
      engine: 'duckduckgo',
    });
    if (results.length >= limit) break;
  }
  return uniqueBy(results, (item) => item.url);
}

export function parseDuckDuckGoLite(html, limit = 8) {
  const results = [];
  const anchors = [...String(html).matchAll(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*result-link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const anchor of anchors) {
    const url = cleanDdgUrl(anchor[1]);
    if (!url || !/^https?:/i.test(url)) continue;
    results.push({
      title: stripTags(anchor[2]).slice(0, 180),
      url,
      snippet: '',
      provider: 'duckduckgo',
      engine: 'duckduckgo',
    });
    if (results.length >= limit) break;
  }
  return uniqueBy(results, (item) => item.url);
}

export function isDuckDuckGoChallenge(html) {
  return /bots use DuckDuckGo|anomaly\.js|Select all squares containing a duck/i.test(String(html || ''));
}

/* ─────────────────────────────────────────────────────────────
   Búsqueda sin clave
   ───────────────────────────────────────────────────────────── */

function searxBaseFromSettings(settings) {
  const raw = String(process.env.LUMBRE_SEARX_URL || settings?.search?.searxUrl || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function resolveSearxInstances(settings, extra = []) {
  const custom = searxBaseFromSettings(settings);
  const list = [];
  if (custom) list.push(custom);
  for (const instance of [...extra, ...SEARX_POOL]) {
    const clean = String(instance || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(clean)) continue;
    if (!list.includes(clean)) list.push(clean);
  }
  return list;
}

function looksLikePublicHttps(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
    if (host.includes(':') || host.startsWith('[')) return false;
    return true;
  } catch {
    return false;
  }
}

/* searx.space mantiene el directorio de instancias públicas con su estado.
   Se usa como refuerzo: si una instancia agota su cuota, hay más para
   rotar. La lista se cachea 6 horas y, si el fetch falla, queda la lista
   fija verificada desde este equipo. */
async function discoverSearxInstances() {
  const now = Date.now();
  if (now - discoveredPool.at < SEARX_DISCOVERY_TTL_MS) return discoveredPool.instances;
  try {
    const page = await fetchSearchPage('https://searx.space/data/instances.json', { timeoutMs: 15000 });
    const data = JSON.parse(page.text);
    const list = Object.entries(data?.instances || {})
      .filter(([url, info]) => (
        looksLikePublicHttps(url)
        && (!info?.network_type || info.network_type === 'normal')
        && info?.http?.status_code === 200
      ))
      .map(([url, info]) => ({
        url: url.replace(/\/+$/, ''),
        timing: Number(info?.timing?.search?.all?.median || 9999),
      }))
      .sort((a, b) => a.timing - b.timing)
      .slice(0, 40)
      .map((item) => item.url);
    if (list.length) {
      discoveredPool.at = now;
      discoveredPool.instances = list;
    }
  } catch { /* seguimos con la lista fija */ }
  return discoveredPool.instances;
}

function stateFor(instance) {
  if (!searxState.has(instance)) {
    searxState.set(instance, { failUntil: 0, lastError: '', hits: [], uses: 0 });
  }
  return searxState.get(instance);
}

function availableSearxInstances(settings, extra = []) {
  const now = Date.now();
  const instances = resolveSearxInstances(settings, extra);
  const ready = [];
  const cooling = [];
  for (const instance of instances) {
    const state = stateFor(instance);
    state.hits = state.hits.filter((at) => now - at < SEARX_WINDOW_MS);
    if (now < state.failUntil) {
      cooling.push({ instance, until: state.failUntil });
      continue;
    }
    if (state.hits.length >= SEARX_MAX_QUERIES_PER_WINDOW) {
      cooling.push({ instance, until: (state.hits[0] || now) + SEARX_WINDOW_MS });
      continue;
    }
    ready.push(instance);
  }
  // Si todas están en espera, se intenta con la que vuelve antes: el dueño
  // prefiere un reintento lento antes que una misión sin búsqueda.
  if (!ready.length && cooling.length) {
    cooling.sort((a, b) => a.until - b.until);
    ready.push(cooling[0].instance);
  }
  return ready;
}

function noteSearxSuccess(instance) {
  const state = stateFor(instance);
  state.failUntil = 0;
  state.lastError = '';
  state.hits.push(Date.now());
  state.uses += 1;
}

function noteSearxFailure(instance, error) {
  const state = stateFor(instance);
  const status = Number(error?.status || 0);
  const hard = status === 429 || status === 403 || status === 401 || status === 503;
  state.failUntil = Date.now() + (hard ? SEARX_HARD_FAIL_COOLDOWN_MS : SEARX_FAIL_COOLDOWN_MS);
  state.lastError = String(error?.message || 'error').slice(0, 200);
}

async function searchSearx(settings, query, limit, attempts = SEARX_ATTEMPTS_PER_QUERY, strict = false) {
  const errors = [];
  const discovered = await discoverSearxInstances();
  const instances = availableSearxInstances(settings, discovered);
  for (const instance of instances.slice(0, Math.max(1, Math.min(SEARX_ATTEMPTS_PER_QUERY, attempts)))) {
    const url = `${instance}/search?q=${encodeURIComponent(query)}&categories=general&language=all&safesearch=0`;
    try {
      const page = await fetchSearchPage(url, { timeoutMs: 12000 });
      if (/Too Many Requests|Rate limit/i.test(page.text.slice(0, 600)) && page.text.length < 2000) {
        const error = new Error('La instancia está limitando consultas');
        error.status = 429;
        throw error;
      }
      const results = filterRelevantResults(query, parseSearxngResults(page.text, limit * 2), { strict }).slice(0, limit);
      if (!results.length) {
        noteSearxFailure(instance, new Error('La instancia no devolvió resultados relevantes'));
        errors.push(`${normalizeDomain(instance)}: sin resultados relevantes`);
        continue;
      }
      noteSearxSuccess(instance);
      return {
        results: results.map((item) => ({ ...item, engine: item.engine || normalizeDomain(instance) })),
        engine: `searxng (${normalizeDomain(instance)})`,
        errors,
      };
    } catch (error) {
      noteSearxFailure(instance, error);
      errors.push(`${normalizeDomain(instance)}: ${error.message || 'error'}`);
    }
  }
  return { results: [], engine: '', errors };
}

async function searchDuckDuckGo(query, limit, strict = false) {
  const errors = [];
  const first = await safeFetchText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=wt-wt`, {
    timeoutMs: 15000,
    maxBytes: 900000,
    headers: { 'user-agent': USER_AGENT },
  }).catch((error) => ({ error }));
  if (!first.error) {
    if (isDuckDuckGoChallenge(first.text)) {
      errors.push('DuckDuckGo pidió una verificación anti-bots: no devolvió resultados.');
    } else {
      const results = filterRelevantResults(query, parseDuckDuckGo(first.text, limit * 2), { strict }).slice(0, limit);
      if (results.length) return { results, engine: 'duckduckgo', errors };
      errors.push('DuckDuckGo no devolvió resultados relevantes.');
    }
  } else {
    errors.push(`DuckDuckGo: ${first.error.message}`);
  }
  const lite = await safeFetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`, {
    timeoutMs: 15000,
    maxBytes: 700000,
    headers: { 'user-agent': USER_AGENT },
  }).catch((error) => ({ error }));
  if (!lite.error && !isDuckDuckGoChallenge(lite.text)) {
    const results = filterRelevantResults(query, parseDuckDuckGoLite(lite.text, limit * 2), { strict }).slice(0, limit);
    if (results.length) return { results, engine: 'duckduckgo', errors };
  }
  return { results: [], engine: '', errors };
}

/* Devuelve { results, engine, errors } sin lanzar. Los errores son parte del
   resultado porque la misión tiene que poder contarlos en su registro. */
export async function searchWebDetailed(settings, query, { count, attempts, strict = false } = {}) {
  const search = settings?.search || {};
  const provider = search.provider || 'duckduckgo';
  const limit = Math.max(1, Math.min(10, Number(count || search.maxResults || 8)));
  const clean = cleanQuery(query);
  if (!clean) return { results: [], engine: '', errors: [] };
  if (provider === 'none') return { results: [], engine: 'none', errors: [] };

  if (provider === 'tavily') {
    if (!search.apiKey) return { results: [], engine: 'tavily', errors: ['Falta la clave de Tavily en Ajustes → Búsqueda'] };
    try {
      const { ok, data, text } = await fetchJson('https://api.tavily.com/search', {
        method: 'POST',
        headers: { authorization: `Bearer ${search.apiKey}` },
        body: {
          query: clean,
          search_depth: 'advanced',
          max_results: limit,
          include_answer: false,
          include_raw_content: false,
        },
        timeoutMs: 30000,
      });
      if (!ok) throw new Error(`Tavily: ${data?.detail || text.slice(0, 200)}`);
      const results = (data?.results || []).map((r) => normalizeResult({
        title: r.title, url: r.url, snippet: r.content, provider, engine: 'tavily',
      })).filter(Boolean);
      return { results, engine: 'tavily', errors: [] };
    } catch (error) {
      return { results: [], engine: 'tavily', errors: [error.message] };
    }
  }

  if (provider === 'brave') {
    if (!search.apiKey) return { results: [], engine: 'brave', errors: ['Falta la clave de Brave en Ajustes → Búsqueda'] };
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(clean)}&count=${limit}`;
      const { ok, data, text } = await fetchJson(url, {
        headers: { 'x-subscription-token': search.apiKey, accept: 'application/json' },
        timeoutMs: 30000,
      });
      if (!ok) throw new Error(`Brave: ${data?.error?.detail || text.slice(0, 200)}`);
      const results = (data?.web?.results || []).map((r) => normalizeResult({
        title: r.title, url: r.url, snippet: r.description, provider, engine: 'brave',
      })).filter(Boolean);
      return { results, engine: 'brave', errors: [] };
    } catch (error) {
      return { results: [], engine: 'brave', errors: [error.message] };
    }
  }

  if (provider === 'serper') {
    if (!search.apiKey) return { results: [], engine: 'serper', errors: ['Falta la clave de Serper en Ajustes → Búsqueda'] };
    try {
      const { ok, data, text } = await fetchJson('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'x-api-key': search.apiKey },
        body: { q: clean, num: limit },
        timeoutMs: 30000,
      });
      if (!ok) throw new Error(`Serper: ${data?.message || text.slice(0, 200)}`);
      const results = (data?.organic || []).map((r) => normalizeResult({
        title: r.title, url: r.link, snippet: r.snippet, provider, engine: 'serper',
      })).filter(Boolean);
      return { results, engine: 'serper', errors: [] };
    } catch (error) {
      return { results: [], engine: 'serper', errors: [error.message] };
    }
  }

  // Sin clave: SearXNG primero y DuckDuckGo como último recurso.
  const custom = searxBaseFromSettings(settings);
  const cacheKey = searchCacheKey('searxng', clean, `${custom}|${strict ? 'strict' : 'loose'}`);
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < QUERY_CACHE_TTL_MS) {
    return { results: cached.results, engine: cached.engine, errors: [], cached: true };
  }

  const searx = await searchSearx(settings, clean, limit, attempts, strict);
  if (searx.results.length) {
    queryCache.set(cacheKey, { at: Date.now(), results: searx.results, engine: searx.engine });
    return { results: searx.results, engine: searx.engine, errors: searx.errors.slice(0, 4) };
  }

  const ddg = await searchDuckDuckGo(clean, limit, strict);
  const results = ddg.results.slice(0, limit);
  if (results.length) {
    queryCache.set(cacheKey, { at: Date.now(), results, engine: ddg.engine });
    return { results, engine: ddg.engine, errors: [...searx.errors, ...ddg.errors].slice(0, 6) };
  }
  return {
    results: [],
    engine: '',
    errors: [
      ...searx.errors,
      ...ddg.errors,
      'No se pudo consultar ningún motor web. Configurá Tavily, Brave o Serper en Ajustes → Búsqueda, o una instancia SearXNG propia.',
    ].slice(0, 8),
  };
}

/* Compatibilidad: quien solo quiere la lista recibe la lista. */
export async function searchWeb(settings, query, options = {}) {
  const detail = await searchWebDetailed(settings, query, options);
  if (!detail.results.length && detail.errors.length) {
    throw new Error(detail.errors[0]);
  }
  return detail.results;
}

/* ─────────────────────────────────────────────────────────────
   Búsqueda de varias consultas
   ───────────────────────────────────────────────────────────── */

export async function searchMany(settings, queries, { perQuery = 5, pages = 0, onProgress, searchAttempts, searchBudgetMs, strict = false } = {}) {
  const provider = settings?.search?.provider || 'duckduckgo';
  const all = [];
  const errors = [];
  const engines = [];
  const list = [...new Set((queries || []).map((q) => cleanQuery(q)).filter(Boolean))].slice(0, 6);
  const started = Date.now();

  // SearXNG público tolera mejor las consultas en serie; los proveedores
  // pagos, en paralelo.
  if (provider === 'duckduckgo' || provider === 'none') {
    for (const query of list) {
      if (searchBudgetMs && Date.now() - started > searchBudgetMs) {
        errors.push('Búsqueda: se alcanzó el tiempo máximo para este paso.');
        break;
      }
      const detail = await searchWebDetailed(settings, query, { count: perQuery, attempts: searchAttempts, strict });
      all.push(...detail.results);
      if (detail.engine && !engines.includes(detail.engine)) engines.push(detail.engine);
      for (const error of detail.errors) errors.push(`${query}: ${error}`);
      onProgress?.({ query, found: detail.results.length, engine: detail.engine || '' });
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
  } else {
    const settled = await Promise.allSettled(list.map((query) => searchWebDetailed(settings, query, { count: perQuery, attempts: searchAttempts, strict })));
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        all.push(...result.value.results);
        if (result.value.engine && !engines.includes(result.value.engine)) engines.push(result.value.engine);
        for (const error of result.value.errors) errors.push(`${list[index]}: ${error}`);
        onProgress?.({ query: list[index], found: result.value.results.length, engine: result.value.engine || '' });
      } else {
        errors.push(`${list[index]}: ${result.reason?.message || 'error'}`);
      }
    });
  }

  const unique = uniqueBy(all.filter(Boolean), (r) => r.url);
  let pageContents = [];
  if (pages > 0 && unique.length) {
    pageContents = await fetchPageContents(unique, { limit: pages });
  }
  return { results: unique, pages: pageContents, errors, engines };
}

export async function fetchPageContents(results, { limit = 3, maxChars = 2400 } = {}) {
  const candidates = results.filter((r) => {
    if (!r.url || !/^https?:/i.test(r.url)) return false;
    if (/\.(pdf|zip|png|jpe?g|webp|gif|mp4|mp3|svg)(\?|$)/i.test(r.url)) return false;
    const domain = normalizeDomain(r.url);
    return !/(facebook|instagram|tiktok|youtube|pinterest|x\.com|twitter|linkedin)\./i.test(domain);
  }).slice(0, limit);

  const settled = await Promise.allSettled(candidates.map(async (result) => {
    const page = await safeFetchText(result.url, { timeoutMs: 12000, maxBytes: 800000 });
    const text = htmlToText(page.text);
    return {
      title: page.title || result.title,
      url: page.finalUrl || result.url,
      content: truncate(text, maxChars),
    };
  }));

  return settled.filter((s) => s.status === 'fulfilled' && s.value.content.length > 200).map((s) => s.value);
}

export function buildResearchQueries(product, markets = []) {
  const name = product?.name || 'lámpara de diseño';
  const category = product?.category || 'iluminación de diseño';
  const country = markets[0] || 'España';
  return [
    `${name} ${category} precio tiendas diseño`,
    `designer lighting market trends 2026 handmade 3d printed`,
    `best design lighting stores ${country} buyers`,
    `import duties lighting fixtures ${country} 2026`,
  ];
}
