import crypto from 'node:crypto';
import { fetchJson, localDayKey } from './util.mjs';
import { sendWithGmailSmtp } from './smtp.mjs';
import { productReadiness } from './readiness.mjs';

/* ─────────────────────────────────────────────────────────────
   Correo: composición, .eml, Resend y webhook.
   El envío nunca es automático. Siempre lo confirma el dueño.
   ───────────────────────────────────────────────────────────── */

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(String(email || '').trim());
}

export function isDemoEmail(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase() || '';
  return domain === 'example.com' || domain === 'example.org' || domain === 'example.net' || domain.endsWith('.example.com');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function emailDomain(email) {
  const clean = normalizeEmail(email);
  return clean.includes('@') ? clean.split('@').pop() : '';
}

/* Dominios donde varias empresas comparten el mismo dominio.
   No sirven para deduplicar por dominio. */
const SHARED_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com',
  'icloud.com', 'me.com', 'proton.me', 'protonmail.com', 'aol.com', 'gmx.com',
  'example.com', 'example.org', 'example.net',
]);

export function isSharedEmailDomain(domain) {
  return SHARED_EMAIL_DOMAINS.has(String(domain || '').toLowerCase());
}

/* ─────────────────────────────────────────────────────────────
   Detección de baja (opt-out) en respuestas.
   Regla de oro: ante la duda, NO suprimir. Un falso positivo pierde
   un lead real y es más caro que pedir una confirmación humana.
   Por eso se ignora todo el texto citado (el pie de nuestros propios
   correos incluye "respondé BAJA" y no debe disparar la baja).
   ───────────────────────────────────────────────────────────── */

const QUOTE_SEPARATORS = [
  /^\s*el\s+.+\s+escribi[oó]:\s*$/i,
  /^\s*la\s+.+\s+escribi[oó]:\s*$/i,
  /^\s*on\s+.+\s+wrote:\s*$/i,
  /^\s*le\s+.+\s+a\s+[ée]crit\s*:\s*$/i,
  /^\s*-{2,}\s*(original message|mensaje original|forwarded message|mensaje reenviado)\s*-{2,}\s*$/i,
  /^\s*_{8,}\s*$/,
  /^\s*-{8,}\s*$/,
  /^\s*_{5,}\s*$/,
];

function isQuoteHeaderStart(line) {
  return QUOTE_SEPARATORS.some((pattern) => pattern.test(line));
}

function looksLikeOutlookHeaders(lines, index) {
  if (!/^\s*(de|from):\s+/i.test(lines[index] || '')) return false;
  const window = lines.slice(index + 1, index + 6).join('\n');
  return /(enviado|sent|fecha|date):\s+/i.test(window)
    || /(para|to):\s+/i.test(window);
}

/* Devuelve solo el texto nuevo de una respuesta: sin citas ">",
   sin cabeceras de reenvío/respuesta y sin nuestro pie de baja. */
export function stripQuotedText(text) {
  let body = String(text || '').replace(/\r\n?/g, '\n');
  // Webhooks de correo a veces entregan solo HTML: el bloque citado suele
  // venir en <blockquote> o en un div de Gmail. Se descarta antes de buscar.
  if (/<\/?(?:blockquote|div|p|br|html|body)\b/i.test(body)) {
    body = body
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '\n')
      .replace(/<div[^>]*(?:gmail_quote|moz-cite-prefix|yahoo_quoted)[\s\S]*?<\/div>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&gt;/gi, '>')
      .replace(/&lt;/gi, '<')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }
  // El pie que agrega ensureCompliance no es una petición del comprador.
  body = body.replace(/^\s*si prefer[ií]s no recibir m[aá]s mensajes[^\n]*$/gim, '');
  const lines = body.split('\n');
  const kept = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*>/.test(line)) continue;
    if (isQuoteHeaderStart(line)) break;
    if (looksLikeOutlookHeaders(lines, index)) break;
    kept.push(line);
  }
  return kept.join('\n').trim();
}

const OPT_OUT_PATTERNS = [
  { rule: 'dar de baja', pattern: /\b(?:dar(?:me|nos)?|darme|denme|den|dense|pongan(?:me)?|ponerme)\s+de\s+baja\b/ },
  { rule: 'baja de la lista', pattern: /\b(?:baja|bajarme|bajenme|bajarse)\s+(?:del?|de\s+la|de\s+este|de\s+su)\s+(?:lista|listado|base|correo|mailing|comunicaciones)\b/ },
  { rule: 'no me escriban más', pattern: /\bno\s+(?:me\s+)?(?:escrib|contact|mand|envi)(?:as|an|es|en|e|a)\s+(?:m[aá]s|nunca|nuevamente)\b/ },
  { rule: 'no quiero recibir más', pattern: /\bno\s+(?:quiero|deseo)\s+(?:recibir|que\s+me\s+(?:escriban|contacten))\s+(?:m[aá]s|nuevamente|nunca)\b/ },
  { rule: 'no volver a escribir', pattern: /\bno\s+volver\s+a\s+(?:escribir|contactar|molestar)\b/ },
  { rule: 'dejen de escribir', pattern: /\bdejen\s+de\s+(?:escribir|contactar|enviar|mandar)\b/ },
  { rule: 'unsubscribe', pattern: /\b(?:unsubscribe|remove\s+me|stop\s+emailing|opt[\s-]?out|do\s+not\s+contact)\b/ },
  { rule: 'do not email', pattern: /\b(?:do\s+not|don't)\s+(?:email|contact|write)\b/ },
  { rule: 'stop sending', pattern: /\b(?:stop|cease)\s+(?:emailing|contacting|sending)\b/ },
  { rule: 'take me off', pattern: /\btake\s+me\s+off\b/ },
];

function normalizeForOptOut(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Devuelve null si no hay baja, o { phrase, rule } si la hay. */
export function detectOptOut(text) {
  const stripped = stripQuotedText(text);
  if (!stripped) return null;
  const lines = stripped.split('\n').map(normalizeForOptOut).filter(Boolean);
  const compact = normalizeForOptOut(stripped);
  const whole = /^(baja|bajarme|bajenme|baja por favor|desuscribirme|unsubscribe|opt out|opt-out|remove me|stop|stop emailing|do not contact|no contactar|no me contacten)$/;
  for (const line of lines) {
    const candidate = line.replace(/[.,;!¿?]+$/g, '').trim();
    if (whole.test(candidate)) return { phrase: candidate, rule: 'mensaje de baja' };
  }
  if (whole.test(compact.replace(/[.,;!¿?]+$/g, '').trim())) {
    return { phrase: compact, rule: 'mensaje de baja' };
  }
  for (const { rule, pattern } of OPT_OUT_PATTERNS) {
    const match = compact.match(pattern);
    if (match) return { phrase: match[0].trim(), rule };
  }
  return null;
}

export function isOptOutText(text) {
  return Boolean(detectOptOut(text));
}

export function normalizeCompany(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Una supresión puede ser por email exacto, por dominio explícito o por empresa.
   Los dominios compartidos (Gmail, Outlook...) nunca se usan para bloquear
   por dominio: bloquearían a miles de personas ajenas. */
export function findSuppression(email, suppressions = [], company = '') {
  const target = normalizeEmail(email);
  const companyKey = normalizeCompany(company);
  const domain = emailDomain(target);
  return (suppressions || []).find((item) => {
    if (!item || typeof item !== 'object') return false;
    const itemEmail = normalizeEmail(item.email);
    if (target && itemEmail && itemEmail === target) return true;
    const itemDomain = String(item.domain || '').toLowerCase();
    if (domain && itemDomain && !isSharedEmailDomain(itemDomain) && itemDomain === domain) return true;
    if (companyKey && normalizeCompany(item.company) === companyKey) return true;
    return false;
  }) || null;
}

export function isSuppressed(email, suppressions = [], company = '') {
  return Boolean(findSuppression(email, suppressions, company));
}

function sanitizeHeader(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

function encodeHeader(value) {
  const clean = sanitizeHeader(value);
  if (!/[^\x20-\x7E]/.test(clean)) return clean;
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`;
}

function splitFrom(from) {
  const match = String(from || '').match(/^(.*)<([^>]+)>$/);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  return { name: '', email: String(from || '').trim() };
}

function formatAddress(name, email) {
  const cleanName = sanitizeHeader(name);
  if (!cleanName) return email;
  return `"${encodeHeader(cleanName)}" <${email}>`;
}

export function htmlFromText(text, { accent = '#b8632f' } = {}) {
  const escaped = String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const clean = url.replace(/[.,;:)]+$/, '');
    return `<a href="${clean}" style="color:${accent};text-decoration:underline">${clean}</a>`;
  });

  const paragraphs = linked.split(/\n{2,}/).map((block) => {
    const withBreaks = block.replace(/\n/g, '<br>');
    return `<p style="margin:0 0 14px;line-height:1.65">${withBreaks}</p>`;
  }).join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f0e6;font-family:Georgia,'Times New Roman',serif;color:#211b16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f0e6;padding:28px 14px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffaf2;border:1px solid #e6d9c7;border-radius:14px;padding:32px 30px">
        <tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#211b16">${paragraphs}</td></tr>
      </table>
      <div style="max-width:560px;margin:14px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8b7b68;text-align:center">
        Enviado con Lucian
      </div>
    </td></tr>
  </table>
</body></html>`;
}

export function ensureCompliance(text, settings) {
  let body = String(text || '').trim();
  const brand = settings?.brand || {};
  const email = settings?.email || {};
  const optOutPattern = /(respond[eé]\s+baja|unsubscribe|date de baja|no\s+recibir\s+m[aá]s)/i;
  if (!optOutPattern.test(body)) {
    body += '\n\nSi preferís no recibir más mensajes, respondé BAJA y no vuelvo a escribirte.';
  }

  // La ubicación no es parte del nombre de LUCIAN. Sólo se incluye una
  // dirección postal completa si el dueño la configuró. Una localidad suelta
  // no satisface el requisito de dirección postal física de CAN-SPAM.
  const identity = [brand.maker || brand.name, brand.address, brand.website]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(' · ');
  if (identity && !body.includes(identity)) {
    body += `\n\n${identity}`;
  }

  const footer = String(email.footer || '').trim();
  if (footer && !body.includes(footer)) {
    body += `\n\n${footer}`;
  }

  return body;
}

/**
 * Filtro único de calidad para el PRIMER contacto comercial generado por IA.
 * No edita textos ni atribuye un origen al producto: obliga a revisar
 * mensajes que exponen inseguridades internas o hechos no comprobados.
 * Se usa tanto al crear borradores como justo antes del envío real.
 */
export function salesCopyIssues({ subject = '', body = '', product = null } = {}) {
  const text = String(body || '').trim();
  const heading = String(subject || '').trim();
  const combined = heading + '\n' + text;
  const issues = [];
  const checks = [
    [/\bpiezas? de autor\b|\bautor[ií]a (?:original|exclusiva)\b|\bdise[nñ]o (?:propio|exclusivo|original)\b/i,
      'No atribuir autoría, exclusividad ni diseño propio sin datos documentados del producto.'],
    [/\bno es (?:un )?dise[nñ]o (?:m[ií]o|propio|nuestro)\b|\bno (?:lo )?(?:dise[nñ][eé]|cre[eé]) (?:yo|nosotros)\b/i,
      'No incluir justificaciones de autoría en una presentación inicial; describir el producto con hechos verificables.'],
    [/\b(?:Lucian|LUCIAN)\s*\(\s*[^)]{2,55}\s*\)/i,
      'LUCIAN es el nombre comercial, no debe llevar una localidad entre paréntesis en la presentación.'],
    [/\bantes de nada\b|\bquiero confirmar (?:que|si)\b|\bcanal correcto\b|\bmejor contacto para seguir\b/i,
      'El primer correo debe presentar una propuesta relevante, no pedir permiso para escribir por el canal.'],
    [/\bno vengo con precio\b|\bno tengo (?:a[uú]n )?(?:precio|costos|ficha|fotos)\b|\b(?:precio|tarifa) (?:a[uú]n )?(?:sin definir|pendiente)\b/i,
      'No enviar un correo de captación anunciando que no hay datos comerciales preparados.'],
    [/\b(?:estoy|estamos) (?:cerrando|calculando|definiendo|viendo|resolviendo) (?:los? |el |las? )?(?:costos?|flete|env[ií]o|precios?|log[ií]stica|fotos?|fotograf[ií]as|ficha)\b/i,
      'Los costos, fotografías y logística pendientes son tareas internas, no argumentos de venta.'],
    [/\bflete interno\b|\b(?:costos?|precios?) (?:todav[ií]a|a[uú]n) (?:no|sin)\b/i,
      'No exponer problemas logísticos o precios incompletos en una primera propuesta comercial.'],
    // Guardias añadidos tras detectar un correoREAL que se envió con todas estas frases.
    [/\b(?:veladores?|l[aá]mparas?|piezas?|dise[nñ]os?) de autor\b/i,
      'No atribuir autoría al producto: describirlo por material, medidas y proceso.'],
    [/\b(?:estoy|estamos) (?:cotizando|validando|preparando) (?:el |los? |la )?(?:env[ií]o|precio|ficha|n[uú]meros)\b/i,
      'No decir que estás cotizando o validando: eso espanta al comprador. Poné el precio concreto.'],
    [/\bantes de hablar de n[uú]meros\b|\bantes de n[uú]meros\b/i,
      'No anunciar que vas a hablar de números después: el precio va en el primer correo.'],
    [/\bdesde caseros\b|\bdesde [A-Z][a-z]+, argentina\b/i,
      'La ciudad postal no va en la presentación; solo en el pie legal si es obligatoria.'],
    [/\bno es una oferta con precio\b|\besta no es una oferta\b|\bes para presentarme\b/i,
      'Todo primer contacto es una oferta con precio concreto, no una presentación sin oferta.'],
    [/\b(?:si prefieren|si prefer[ií]s) que no les escriba\b|\bno insisto\b/i,
      'No cerrar con disculpas ni invitar al rechazo: cerrar con el pedido.'],
    [/\b(?:les escribo en fr[ií]o|escribo en fr[ií]o)\b/i,
      'No decir "escribo en frío": delata correo masivo. Empezá con un hecho concreto del comprador.'],
  ];
  for (const [pattern, explanation] of checks) {
    if (pattern.test(combined)) issues.push(explanation);
  }
  if (!text || !heading) issues.push('Todo primer contacto necesita asunto y un mensaje concreto.');
  if (product) {
    const readiness = productReadiness(product);
    if (!readiness.readyForProspecting) {
      const critical = readiness.missing.filter((check) => check.critical).map((check) => check.label).join('; ');
      issues.push('Ficha de producto incompleta: ' + (critical || 'verificar fotografías y precio'));
    }
  }
  return [...new Set(issues)];
}

export function composeEmail(thread, draft, settings) {
  const contact = thread?.contact || {};
  const brand = settings?.brand || {};
  const from = String(settings?.email?.from || '').trim() || (brand.email ? `${brand.name} <${brand.email}>` : '');
  const subject = String(draft?.subject || '').trim() || `Una pieza de ${brand.name || 'Lucian'} para ${contact.company || 'tu tienda'}`;
  const text = ensureCompliance(draft?.body || '', settings);
  return {
    to: contact.email || '',
    from,
    replyTo: settings?.email?.replyTo || '',
    subject,
    text,
    html: htmlFromText(text),
    demo: Boolean(thread?.demo || isDemoEmail(contact.email)),
  };
}

export function buildEml(message) {
  const { from, to, subject, text, html, replyTo, messageId, inReplyTo, references } = message;
  const parsedFrom = splitFrom(from);
  if (!parsedFrom.email) throw new Error('Falta el remitente');
  if (!isValidEmail(to)) throw new Error('El destinatario no es un email válido');

  const domain = parsedFrom.email.split('@')[1] || 'lucian.local';
  const id = sanitizeHeader(messageId) || `<${crypto.randomUUID()}@${domain}>`;
  const date = new Date().toUTCString();
  const boundary = `lucian_${crypto.randomUUID().replace(/-/g, '')}`;
  const bodyText = Buffer.from(String(text || ''), 'utf8').toString('base64');
  const bodyHtml = Buffer.from(String(html || htmlFromText(text)), 'utf8').toString('base64');

  const headers = [
    `From: ${formatAddress(parsedFrom.name, parsedFrom.email)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${date}`,
    `Message-ID: ${id}`,
    'MIME-Version: 1.0',
  ];
  if (replyTo && isValidEmail(splitFrom(replyTo).email)) headers.push(`Reply-To: ${sanitizeHeader(replyTo)}`);
  // Hilos: sin In-Reply-To/References el cliente de correo del comprador abre
  // una conversación nueva y las respuestas se pierden.
  if (inReplyTo) headers.push(`In-Reply-To: ${sanitizeHeader(inReplyTo)}`);
  if (references) headers.push(`References: ${sanitizeHeader(references)}`);
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  return `${headers.join('\r\n')}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${bodyText}\r\n--${boundary}\r\nContent-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n${bodyHtml}\r\n--${boundary}--\r\n`;
}

export function emlFilename(thread, draft) {
  const company = String(thread?.contact?.company || 'contacto').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  const subject = String(draft?.subject || 'mensaje').slice(0, 40).replace(/[^a-zA-Z0-9_-]+/g, '-');
  return `${company || 'contacto'}-${subject || 'mensaje'}.eml`;
}

export async function sendWithResend(settings, message) {
  const key = settings?.email?.resendKey;
  if (!key) throw new Error('Falta la clave de Resend en Ajustes → Correo');
  if (!message.from) throw new Error('Falta configurar el remitente en Ajustes → Correo');

  const headers = {};
  if (message.messageId) headers['Message-ID'] = sanitizeHeader(message.messageId);
  if (message.inReplyTo) headers['In-Reply-To'] = sanitizeHeader(message.inReplyTo);
  if (message.references) headers.References = sanitizeHeader(message.references);

  const { ok, data, text } = await fetchJson('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: {
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    },
    timeoutMs: 30000,
  });
  if (!ok) throw new Error(`Resend: ${data?.message || data?.error?.message || text.slice(0, 300)}`);
  return { id: data?.id || '', provider: 'resend' };
}

export async function sendWithGmail(settings, message) {
  const email = settings?.email || {};
  const user = String(email.smtpUser || '').trim();
  const pass = String(email.smtpPassword || '').trim();
  if (!user || !pass) throw new Error('Falta el usuario o la contraseña de aplicación de Gmail en Ajustes → Correo.');
  return await sendWithGmailSmtp({
    user,
    appPassword: pass,
    from: message.from || user,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    replyTo: message.replyTo,
    messageId: message.messageId,
    inReplyTo: message.inReplyTo,
    references: message.references,
  });
}

export async function sendWithWebhook(settings, message, extra = {}) {
  const url = settings?.email?.webhookUrl;
  if (!url) throw new Error('Falta la URL del webhook en Ajustes → Correo');
  const { ok, data, text } = await fetchJson(url, {
    method: 'POST',
    headers: settings?.email?.webhookToken ? { 'x-lucian-token': settings.email.webhookToken } : {},
    body: {
      to: message.to,
      from: message.from,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      ...(message.messageId ? { messageId: message.messageId } : {}),
      ...(message.inReplyTo ? { inReplyTo: message.inReplyTo } : {}),
      ...(message.references ? { references: message.references } : {}),
      ...extra,
    },
    timeoutMs: 30000,
  });
  // Un webhook de correo debe responder con JSON confirmando el envío.
  // Si devuelve una página HTML (como una web cualquiera), NO es un
  // servicio de correo: marcarlo como "enviado" sería un falso positivo.
  // Antes pasaba: https://lucian.com devolvía 200 con HTML y los correos
  // quedaban como enviados sin que nadie los recibiera.
  const looksLikeHtml = /<(!doctype|html|head|body)\b/i.test(text || '');
  if (looksLikeHtml) {
    throw new Error('El webhook devolvió una página web en vez de una confirmación JSON. No es un servicio de correo: revisá la URL en Ajustes → Correo.');
  }
  if (!ok) throw new Error(`Webhook: ${data?.message || text.slice(0, 300)}`);
  if (!data || typeof data !== 'object') {
    throw new Error('El webhook no confirmó el envío con JSON. No se marcó como enviado.');
  }
  return { id: data?.id || '', provider: 'webhook' };
}

export async function testResend(settings) {
  const key = settings?.email?.resendKey;
  if (!key) throw new Error('Falta la clave de Resend');
  const response = await fetch('https://api.resend.com/domains', {
    headers: { authorization: `Bearer ${key}` },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Resend: ${text.slice(0, 300)}`);
  const data = JSON.parse(text || '{}');
  return { domains: (data.data || []).map((d) => ({ name: d.name, status: d.status })) };
}

/* ─────────────────────────────────────────────────────────────
   Límites de envío y calentamiento
   ───────────────────────────────────────────────────────────── */

export function sentToday(threads) {
  const today = localDayKey();
  let count = 0;
  for (const thread of threads || []) {
    for (const message of thread.messages || []) {
      if (message.direction !== 'out') continue;
      // Los envíos marcados a mano desde el correo del dueño no consumen
      // el cupo de calentamiento del envío automático.
      if (message.status !== 'enviado') continue;
      if (message.provider === 'manual' || message.channel === 'manual') continue;
      if (localDayKey(message.at || message.sentAt) !== today) continue;
      count += 1;
    }
  }
  return count;
}

export function firstSentDate(threads) {
  let first = null;
  for (const thread of threads || []) {
    for (const message of thread.messages || []) {
      if (message.direction !== 'out' || message.status !== 'enviado') continue;
      if (message.provider === 'manual' || message.channel === 'manual') continue;
      const date = new Date(message.at || message.sentAt);
      if (Number.isNaN(date.getTime())) continue;
      if (!first || date < first) first = date;
    }
  }
  return first;
}

export function dailyLimitInfo(settings, threads) {
  const configured = Number(settings?.email?.dailyLimit) || 20;
  const used = sentToday(threads);
  if (!settings?.email?.warmup) {
    return { limit: configured, used, remaining: Math.max(0, configured - used), warmup: false, day: null };
  }
  const first = firstSentDate(threads);
  if (!first) {
    const limit = Math.min(configured, 10);
    return { limit, used, remaining: Math.max(0, limit - used), warmup: true, day: 1 };
  }
  const days = Math.max(1, Math.floor((Date.now() - first.getTime()) / 86400000) + 1);
  const week = Math.ceil(days / 7);
  const limit = Math.min(configured, week <= 1 ? 10 : week === 2 ? 20 : week === 3 ? 30 : configured);
  return { limit, used, remaining: Math.max(0, limit - used), warmup: true, day: days };
}

export function assertCanSend(settings, threads, email, suppressions = [], options = {}) {
  const manual = options.manual === true;
  const company = options.company || '';
  const target = normalizeEmail(email);

  if (isSuppressed(target, suppressions, company)) {
    throw new Error('Ese contacto pidió no recibir más mensajes (lista de no contactar).');
  }
  // El envío manual es el dueño usando su propio correo o el formulario de la
  // tienda: no necesita dirección, no consume cupo y sirve para registrar
  // contactos por LinkedIn/formulario. Los canales reales sí exigen email.
  if (manual) return dailyLimitInfo(settings, threads);

  if (!isValidEmail(target)) throw new Error('El contacto no tiene un email válido.');
  if (isDemoEmail(target)) throw new Error('Es un email de ejemplo (example.com). No se puede enviar desde una misión demo.');
  if (settings?.email?.provider === 'resend' && !settings?.email?.resendKey) {
    throw new Error('Elegiste Resend pero falta la clave en Ajustes → Correo.');
  }
  if (settings?.email?.provider === 'gmail') {
    if (!settings?.email?.smtpUser || !settings?.email?.smtpPassword) {
      throw new Error('Elegiste Gmail pero faltan el usuario o la contraseña de aplicación en Ajustes → Correo.');
    }
  }
  const info = dailyLimitInfo(settings, threads);
  if (info.remaining <= 0) {
    throw new Error(`Llegaste al límite de ${info.limit} envíos por hoy${info.warmup ? ` (semana de calentamiento, día ${info.day})` : ''}.`);
  }
  return info;
}

/* Los proveedores de correo entrante mandan los identificadores de hilo con
   nombres distintos y, a veces, dentro de `headers`. Normalizamos ambos
   formatos: sin esto, dos hilos del mismo comprador se mezclan. */
function headerValue(source, name) {
  if (!source || typeof source !== 'object') return '';
  const headers = source.headers && typeof source.headers === 'object' ? source.headers : source;
  const wanted = String(name).toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== wanted) continue;
    if (Array.isArray(value)) return value.filter(Boolean).join(' ').trim();
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function referenceList(value) {
  const raw = Array.isArray(value) ? value : String(value || '').match(/<[^>]+>/g) || [];
  return raw.map((item) => String(item).trim()).filter((item) => /^<[^>]+>$/.test(item));
}

export function parseInbound(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const fromRaw = data.from || data.sender || data.email || '';
  const from = typeof fromRaw === 'string' ? fromRaw : fromRaw?.email || '';
  const to = Array.isArray(data.to) ? data.to[0] : data.to || '';
  const subject = data.subject || '';
  const text = data.text || data.plain || data.body || '';
  const html = data.html || '';
  if (!from || (!text && !html)) return null;
  const messageId = data.messageId || data.message_id || headerValue(data, 'message-id');
  const inReplyTo = data.inReplyTo || data.in_reply_to || headerValue(data, 'in-reply-to');
  const referencesRaw = data.references || headerValue(data, 'references');
  return {
    from: String(from),
    to: String(to),
    subject: String(subject),
    text: String(text),
    html: String(html),
    messageId: String(messageId || '').trim(),
    inReplyTo: String(inReplyTo || '').trim(),
    references: referenceList(referencesRaw),
  };
}

/* Eventos de entrega (Resend y formatos equivalentes). Un rebote duro o una
   queja de spam no son una respuesta: hay que suprimir la dirección antes de
   que el siguiente envío queme el dominio. */
const EMAIL_EVENTS = {
  'email.bounced': 'bounce',
  'email.complained': 'complaint',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.delivery_delayed': 'delayed',
};

function eventEmail(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/<([^>]+)>/);
  return normalizeEmail(match ? match[1] : raw);
}

export function parseEmailEvent(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const type = String(payload.type || payload.event || payload.event_type || '').toLowerCase();
  let kind = EMAIL_EVENTS[type] || '';
  if (!kind && /bounce/.test(type)) kind = 'bounce';
  if (!kind && /complain/.test(type)) kind = 'complaint';
  if (!kind) return null;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const recipients = data.to ?? data.recipient ?? data.recipients ?? data.email ?? '';
  const emails = [...new Set((Array.isArray(recipients) ? recipients : [recipients]).map(eventEmail).filter(isValidEmail))];
  const bounce = data.bounce && typeof data.bounce === 'object' ? data.bounce : {};
  const severity = `${bounce.type || ''} ${bounce.subType || ''} ${data.severity || ''}`;
  return {
    type,
    kind,
    emails,
    hard: kind === 'complaint' || (kind === 'bounce' && !/transient|soft|delayed/i.test(severity)),
    messageId: String(data.messageId || data.message_id || headerValue(data, 'message-id') || '').trim(),
    reason: String(bounce.message || data.reason || data.error || '').slice(0, 500),
  };
}
