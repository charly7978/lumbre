import { extractEmails, fetchJson, htmlToText, normalizeDomain, safeFetchText, truncate, uniqueBy } from './util.mjs';

/* ─────────────────────────────────────────────────────────────
   Enriquecimiento y verificación de compradores.

   Regla de oro: no inventamos direcciones. Un email solo se usa si
   está publicado en el sitio del comprador (o lo devuelve Hunter con
   dominio verificado). El email que "propone" el modelo se descarta
   si no aparece en el sitio: un local-part inventado sobre un dominio
   real parece válido y rebota igual.
   ───────────────────────────────────────────────────────────── */

const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function cached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(key); return null; }
  return hit.value;
}

function remember(key, value) {
  cache.set(key, { at: Date.now(), value });
  return value;
}

const ROLE_PRIORITY = [
  [/^(compras|purchas|buyer|buying|procurement)/i, 100],
  [/^(hola|hello|hi|contacto|contact|info|saludos)/i, 80],
  [/^(ventas|sales|comercial|trade|wholesale)/i, 75],
  [/^(direccion|direction|management|gerencia|admin|office|studio|estudio)/i, 60],
  [/^(founder|owner|socio|ceo|fundador)/i, 55],
];

const BAD_EMAIL = /^(noreply|no-reply|donotreply|privacy|legal|jobs|careers|rrhh|prensa|press|abuse|postmaster|webmaster|soporte|support|ayuda|help|billing|facturacion|cobros)/i;

function scoreEmail(email) {
  const local = String(email).split('@')[0].toLowerCase();
  if (BAD_EMAIL.test(local)) return -10;
  for (const [regex, score] of ROLE_PRIORITY) if (regex.test(local)) return score;
  if (local.includes('.')) return 30;
  return 20;
}

export function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const GENERIC_NAME_TOKENS = new Set([
  'home', 'shop', 'store', 'house', 'casa', 'studio', 'estudio', 'gallery', 'galeria',
  'design', 'diseno', 'lighting', 'iluminacion', 'lamp', 'lampara', 'lamparas', 'light',
  'concept', 'interiorismo', 'interior', 'decoracion', 'decor', 'the', 'and', 'los', 'las',
  'del', 'tienda', 'tiendas', 'market', 'marketplace', 'grupo', 'group', 'boutique', 'world',
]);

function nameTokens(name) {
  return [...new Set(normalizeText(name).split(' ').filter((token) => token.length >= 4))];
}

function distinctiveNameTokens(name) {
  return nameTokens(name).filter((token) => !GENERIC_NAME_TOKENS.has(token));
}

const SITE_PATHS = ['', '/contacto', '/contact', '/about', '/nosotros', '/quienes-somos', '/contacte', '/contactar'];

/* Lee el sitio del comprador una sola vez y devuelve lo que sirve para
   verificar identidad y contactos: título, texto, emails y páginas. */
export async function inspectSite(website, { maxPages = 3 } = {}) {
  const domain = normalizeDomain(website);
  if (!domain || /(^|\.)example\.(com|org|net)$/i.test(domain)) {
    return { reachable: false, domain, emails: [], pages: [], title: '', sample: '' };
  }
  const cacheKey = `inspect:${domain}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const base = /^https?:\/\//i.test(website) ? website.replace(/\/+$/, '') : `https://${website.replace(/\/+$/, '')}`;
  const selected = [base, ...SITE_PATHS.slice(1).map((suffix) => `${base}${suffix}`)]
    .slice(0, Math.max(1, maxPages + 1));

  const settled = await Promise.allSettled(selected.map(async (url) => {
    const page = await safeFetchText(url, { timeoutMs: 12000, maxBytes: 700000 });
    const text = htmlToText(page.text);
    return { url: page.finalUrl || url, title: page.title || '', text, html: page.text };
  }));

  const pages = [];
  const samples = [];
  const emails = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    const page = result.value;
    pages.push(page.url);
    if (page.title) samples.push(page.title);
    if (page.text) samples.push(page.text.slice(0, 12000));
    const found = extractEmails(`${page.text}\n${page.html}`);
    for (const email of found) {
      if (email.length > 100) continue;
      const domainOfEmail = email.split('@')[1] || '';
      if (normalizeDomain(domainOfEmail) !== domain && !domainOfEmail.endsWith(domain) && !domain.endsWith(domainOfEmail)) continue;
      const score = scoreEmail(email);
      if (score < 0) continue;
      emails.push({ email, source: page.url, score });
    }
  }

  const value = {
    reachable: pages.length > 0,
    domain,
    pages,
    title: settled.find((s) => s.status === 'fulfilled' && s.value.title)?.value.title || '',
    sample: truncate(samples.join('\n'), 30000),
    emails: uniqueBy(emails.sort((a, b) => b.score - a.score), (item) => item.email).slice(0, 4),
  };
  return remember(cacheKey, value);
}

/* Verifica que el sitio exista y que hable del comprador. Sin esta prueba
   no se crea una conversación: es la diferencia entre un prospecto real y
   un nombre inventado por el modelo. */
export async function verifyWebsite(website, name) {
  const domain = normalizeDomain(website);
  if (!domain) return { ok: false, status: 'sin_sitio', title: '', url: '', reason: 'Sin sitio web' };
  let site;
  try {
    site = await inspectSite(website, { maxPages: 2 });
  } catch (error) {
    return { ok: false, status: 'no_responde', title: '', url: '', reason: truncate(error.message, 160) };
  }
  if (!site.reachable) {
    return { ok: false, status: 'no_responde', title: '', url: '', reason: 'El sitio no respondió en este momento.' };
  }
  const haystack = normalizeText(`${site.title} ${site.sample} ${domain}`);
  // Un sitio que anuncia el cierre no es un comprador actual, aunque el
  // nombre aparezca (caso real: la web conmemorativa de una tienda cerrada).
  if (/(hemos cerrado|cerramos nuestras puertas|cerrado definitivamente|tienda cerrada|closed permanently|we are closed|closing down|going out of business|out of business|1929\s*[-–]\s*20\d\d|en memoria)/i.test(`${site.title} ${site.sample}`)) {
    return { ok: false, status: 'cerrado', title: site.title, url: site.pages[0] || '', reason: 'El sitio indica que la tienda cerró.' };
  }
  const tokens = distinctiveNameTokens(name).sort((a, b) => b.length - a.length);
  if (!tokens.length) {
    // Nombres como "The IQ Home" o "GA Iluminación": sin una palabra propia
    // no hay forma de distinguir el sitio real de cualquier página que use la
    // misma palabra genérica. Se exige que el nombre completo esté en el
    // dominio o en el título.
    const squashedName = normalizeText(name).replace(/ /g, '');
    const squashedIdentity = normalizeText(`${site.title} ${domain}`).replace(/ /g, '');
    const ok = squashedName.length >= 5 && squashedIdentity.includes(squashedName);
    return {
      ok,
      status: ok ? 'verificado' : 'sin_coincidencia',
      title: site.title,
      url: site.pages[0] || '',
      reason: ok ? '' : `El nombre "${name}" es demasiado genérico para verificarlo.`,
    };
  }
  const identity = normalizeText(`${site.title} ${domain}`);
  const titleMatch = tokens.some((token) => identity.includes(token));
  const bodyMatch = tokens.some((token) => haystack.includes(token));
  if (!titleMatch && bodyMatch) {
    // El nombre aparece en el texto, pero no en el título ni en el dominio:
    // puede ser una nota que menciona la tienda, no su sitio oficial.
    return {
      ok: true,
      status: 'fuente_secundaria',
      title: site.title,
      url: site.pages[0] || '',
      reason: 'La página menciona la tienda pero no parece su sitio oficial.',
    };
  }
  const ok = titleMatch;
  return {
    ok,
    status: ok ? 'verificado' : 'sin_coincidencia',
    title: site.title,
    url: site.pages[0] || '',
    reason: ok ? '' : `El sitio no menciona "${name}" en su portada.`,
  };
}

export async function findEmailsOnSite(website, { maxPages = 3 } = {}) {
  const site = await inspectSite(website, { maxPages });
  return { emails: site.emails, pages: site.pages };
}

export async function hunterDomainSearch(apiKey, domain) {
  if (!apiKey) throw new Error('Falta la clave de Hunter');
  const clean = normalizeDomain(domain);
  if (!clean) throw new Error('Dominio inválido');
  const cacheKey = `hunter:${clean}`;
  const hit = cached(cacheKey);
  if (hit) return hit;

  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(clean)}&limit=10&api_key=${encodeURIComponent(apiKey)}`;
  const { ok, data, text } = await fetchJson(url, { timeoutMs: 25000 });
  if (!ok) throw new Error(`Hunter: ${data?.errors?.[0]?.details || text.slice(0, 200)}`);
  const emails = (data?.data?.emails || []).map((item) => ({
    email: item.value,
    name: [item.first_name, item.last_name].filter(Boolean).join(' '),
    position: item.position || '',
    type: item.type || '',
    confidence: Number(item.confidence || 0),
    verification: item.verification?.status || 'unknown',
    source: 'hunter',
  })).filter((item) => item.email);
  const result = { pattern: data?.data?.pattern || '', organization: data?.data?.organization || '', emails };
  return remember(cacheKey, result);
}

export async function hunterVerify(apiKey, email) {
  if (!apiKey) throw new Error('Falta la clave de Hunter');
  const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(apiKey)}`;
  const { ok, data, text } = await fetchJson(url, { timeoutMs: 25000 });
  if (!ok) throw new Error(`Hunter: ${data?.errors?.[0]?.details || text.slice(0, 200)}`);
  return {
    email,
    status: data?.data?.status || 'unknown',
    score: Number(data?.data?.score || 0),
    disposable: Boolean(data?.data?.disposable),
    webmail: Boolean(data?.data?.webmail),
    acceptAll: Boolean(data?.data?.accept_all),
  };
}

export async function hunterAccount(apiKey) {
  const { ok, data, text } = await fetchJson(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(apiKey)}`, { timeoutMs: 20000 });
  if (!ok) throw new Error(`Hunter: ${data?.errors?.[0]?.details || text.slice(0, 200)}`);
  return data?.data || {};
}

function pickBestHunterEmail(result, contactName = '') {
  if (!result?.emails?.length) return null;
  const nameParts = String(contactName).toLowerCase().split(/\s+/).filter(Boolean);
  const scored = result.emails.map((item) => {
    let score = item.confidence;
    if (/purchas|buyer|compras|wholesale|trade|owner|founder|ceo/i.test(`${item.position} ${item.type}`)) score += 25;
    if (nameParts.length && nameParts.some((part) => item.name?.toLowerCase().includes(part))) score += 20;
    if (item.verification === 'valid') score += 15;
    return { ...item, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0];
}

export async function enrichProspect(prospect, settings) {
  const update = {};
  const website = prospect.web || prospect.website || '';
  const apiKey = settings?.hunter?.apiKey;
  const hunterEnabled = Boolean(settings?.hunter?.enabled && apiKey);
  const proposedEmail = String(prospect.email || '').trim().toLowerCase();

  let site = null;
  if (website) {
    try {
      site = await inspectSite(website, { maxPages: 3 });
    } catch { /* seguimos sin sitio */ }
  }

  if (proposedEmail) {
    // Solo se acepta si está publicado en el sitio. Si no, se descarta y se
    // deja constancia: no queremos mandar correos a direcciones inventadas.
    const published = site?.emails?.find((item) => item.email === proposedEmail);
    if (published) {
      update.email = published.email;
      update.email_estado = 'publico';
      update.email_fuente = published.source;
    } else {
      update.email = '';
      update.email_estado = 'descartado_no_verificado';
      update.email_fuente = '';
      update.email_aviso = 'El email que propuso el modelo no aparece publicado en el sitio: se descartó.';
    }
  }

  if (!update.email && site?.emails?.length) {
    update.email = site.emails[0].email;
    update.email_estado = 'publico';
    update.email_fuente = site.emails[0].source;
  }

  if (!update.email && hunterEnabled && website) {
    try {
      const found = await hunterDomainSearch(apiKey, website);
      const best = pickBestHunterEmail(found, prospect.contacto || prospect.nombre);
      if (best) {
        update.email = best.email;
        update.email_estado = best.verification === 'valid' ? 'verificado' : 'probable';
        update.email_fuente = 'hunter';
        update.email_confianza = best.confidence;
        if (best.position && !prospect.contacto) update.contacto = best.position;
        if (best.name && !prospect.contacto) update.contacto = best.name;
      }
    } catch { /* seguimos */ }
  }

  if (update.email && hunterEnabled) {
    try {
      const verified = await hunterVerify(apiKey, update.email);
      if (verified.status === 'valid') update.email_estado = 'verificado';
      else if (verified.status === 'invalid' || verified.status === 'disposable') {
        update.email = '';
        update.email_estado = 'descartado_no_verificado';
        update.email_aviso = `Hunter marcó la dirección como ${verified.status}: se descartó.`;
      }
    } catch { /* seguimos */ }
  }

  update.web_estado = site?.reachable ? 'activo' : (website ? 'no_responde' : 'sin_sitio');
  if (!update.email && !prospect.email_estado) update.email_estado = 'desconocido';
  return update;
}

export function contactPageFor(website) {
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return `${url.origin}/contacto`;
  } catch {
    return '';
  }
}
