/* ============================================================
   LUCIAN · aplicación
   Vanilla JS, sin dependencias. Estado local + API del servidor.
   ============================================================ */

/* ─────────────────────────────────────────────────────────────
   1. Constantes de dominio
   ───────────────────────────────────────────────────────────── */

const AGENTS = [
  { id: 'director', name: 'Director Comercial', initials: 'DC', role: 'Estrategia y decisiones', color: '#c98a3c', bio: 'Convierte el producto y el objetivo en una tesis comercial concreta. Decide a quién venderle primero, con qué ángulo y qué no hacer.', focus: ['Tesis comercial', 'Prioridades', 'Plan de 7 días'] },
  { id: 'mercado', name: 'Analista de Mercado', initials: 'AM', role: 'Investigación y competencia', color: '#6f8173', bio: 'Lee el mercado real: tiendas, competidores, precios, temporadas y términos de búsqueda. Separa moda de demanda.', focus: ['Tendencias', 'Competidores', 'Canales'] },
  { id: 'aduanas', name: 'Especialista en Aduanas', initials: 'EA', role: 'Importación y logística', color: '#63788a', bio: 'Anticipa aranceles, impuestos, certificaciones y etiquetado antes de que un envío quede trabado.', focus: ['Aranceles', 'Certificaciones', 'Couriers'] },
  { id: 'precios', name: 'Analista de Precios', initials: 'AP', role: 'Márgenes y rentabilidad', color: '#b56c4a', bio: 'Calcula costo aterrizado, precio directo, mayorista y galería. Busca el punto donde el precio no frena la venta ni te deja sin margen.', focus: ['Landed cost', 'Márgenes', 'Descuentos'] },
  { id: 'cazador', name: 'Cazador de Compradores', initials: 'CC', role: 'Prospección', color: '#8b7654', bio: 'Encuentra tiendas, distribuidores, interioristas y hoteles que ya venden diseño. Verifica contactos y descarta fantasmas.', focus: ['Prospectos', 'Contactos', 'Priorización'] },
  { id: 'redactor', name: 'Redactor Comercial', initials: 'RC', role: 'Mensajes que abren puertas', color: '#a65d3f', bio: 'Escribe correos breves, específicos y humanos. Nada de plantillas con “espero que estés bien”. Un solo pedido por mensaje.', focus: ['Secuencias', 'Personalización', 'Objeciones'] },
  { id: 'contenido', name: 'Director de Contenido', initials: 'CO', role: 'Redes y narrativa', color: '#9a6f8e', bio: 'Diseña contenido que muestra el objeto y el proceso, no que grita “comprá”. Piensa en series, no en posts sueltos.', focus: ['Calendario', 'Ganchos', 'Series'] },
  { id: 'cumplimiento', name: 'Guardián de Cumplimiento', initials: 'GC', role: 'Riesgos legales y reputación', color: '#6a7a86', bio: 'Revisa afirmaciones, bases legales de contacto, opt-out y promesas. Prefiere perder una venta antes que quemar la marca.', focus: ['Claims', 'Privacidad', 'Revisión'] },
  { id: 'redteam', name: 'Abogado del Diablo', initials: 'AD', role: 'Contradicción', color: '#8f4f45', bio: 'Su trabajo es encontrar por qué el plan puede fallar. Sin crueldad y sin diplomacia: si un número no cierra, lo dice.', focus: ['Supuestos', 'Agujeros', 'Escenarios'] },
  { id: 'memoria', name: 'Memoria y Aprendizaje', initials: 'MA', role: 'Aprendizaje acumulado', color: '#7c7a5c', bio: 'Extrae lo que esta misión enseñó para que la próxima no empiece de cero. Guarda solo lo que tiene evidencia.', focus: ['Aprendizajes', 'Patrones', 'Confianza'] },
  { id: 'analista', name: 'Analista de Respuestas', initials: 'AR', role: 'Bandeja y seguimiento', color: '#5f7b72', bio: 'Lee lo que respondió el comprador, detecta la intención real y propone el siguiente paso sin sonar desesperado.', focus: ['Intención', 'Siguiente paso', 'Borradores'] },
];

const DEPTHS = {
  rapida: { label: 'Rápida', description: 'Lo esencial para salir a vender esta semana. 8 pasos, sin contenido ni red team.', steps: 8, calls: 7, minutes: '2”“4' },
  estandar: { label: 'Estándar', description: 'El equipo completo: investigación, aduanas, precios, compradores, mensajes, contenido, cumplimiento y crítica.', steps: 12, calls: 10, minutes: '4”“8' },
  profunda: { label: 'Profunda', description: 'Todo lo anterior más una revisión y corrección obligatoria después del red team.', steps: 13, calls: 11, minutes: '6”“12' },
};

const GOALS = [
  { id: 'conseguir-mayoristas', title: 'Conseguir tiendas mayoristas', sub: 'Tiendas, concept stores y distribuidores que compren series cortas.' },
  { id: 'vender-directo', title: 'Vender directo online', sub: 'Piezas únicas o series pequeñas a compradores finales.' },
  { id: 'entrar-hoteleria', title: 'Entrar en hotelería', sub: 'Hoteles boutique y estudios que amueblan espacios completos.' },
  { id: 'lanzar-coleccion', title: 'Lanzar una colección', sub: 'Presentar una serie nueva con narrativa y calendario de contenido.' },
  { id: 'validar-precio', title: 'Validar precio y margen', sub: 'Saber cuánto cobrar sin regalar la pieza ni quedar fuera de mercado.' },
  { id: 'abrir-mercado', title: 'Abrir un mercado nuevo', sub: 'Probar otro país con aduanas, canales y compradores concretos.' },
];

const MARKET_OPTIONS = ['España', 'México', 'Estados Unidos', 'Argentina', 'Chile', 'Colombia', 'Uruguay', 'Brasil', 'Portugal', 'Francia', 'Italia', 'Reino Unido', 'Alemania', 'Dinamarca', 'Canadá', 'Australia'];

const TONES = [
  'cercano, experto, sin presión',
  'sobrio y directo, sin vueltas',
  'cálido y narrativo, con historia',
  'técnico y preciso, para estudios',
];

const STAGES = { nuevo: 'Nuevo', contactado: 'Contactado', respondio: 'Respondió', interesado: 'Interesado', negociando: 'Negociando', ganado: 'Ganado', perdido: 'Perdido' };
const STAGE_TONE = { nuevo: 'neutral', contactado: 'info', respondio: 'amber', interesado: 'ok', negociando: 'warn', ganado: 'ok', perdido: 'danger' };
const CONTENT_STATUS = { idea: 'Idea', borrador: 'Borrador', publicado: 'Publicado', archivado: 'Archivado' };
const MISSION_STATUS = { queued: 'En cola', running: 'Trabajando', done: 'Completada', done_with_warnings: 'Con avisos', error: 'Con error', cancelled: 'Cancelada' };
const CHANNEL_LABEL = { email: 'Email', formulario: 'Formulario', whatsapp: 'WhatsApp', otro: 'Otro', manual: 'Manual', resend: 'Resend', webhook: 'Webhook' };
const CURRENCIES = ['USD', 'EUR', 'ARS', 'MXN', 'COP', 'CLP', 'BRL', 'GBP'];

/* ─────────────────────────────────────────────────────────────
   2. Iconos
   ───────────────────────────────────────────────────────────── */

const ICON_PATHS = {
  panel: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  spark: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="m19 15 .7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9L19 15Z"/>',
  inbox: '<path d="M4 4h16v12l-4 4H8l-4-4V4Z"/><path d="M4 13h4l1.5 2h5L16 13h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-4.5-4.5L6 21"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.26.6.87 1 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 11v6M14 11v6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  play: '<path d="m6 3 14 9-14 9V3Z"/>',
  pause: '<path d="M8 4v16M16 4v16"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  scale: '<path d="M12 3v18M5 7h14"/><path d="m5 7-3 6h6L5 7ZM19 7l-3 6h6l-3-6Z"/><path d="M8 21h8"/>',
  dollar: '<path d="M12 2v20"/><path d="M17 6.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5 2.2 3.5 5 3.5 5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5"/>',
  wand: '<path d="m15 4 5 5L8 21l-5-5L15 4Z"/><path d="m6 14 1.5 1.5"/><path d="M19 2v3M21.5 3.5h-3"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 8.8-8.8M16 7l2 2M18.5 4.5l2 2"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 14v4M12 9v9M17 5v13"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  tag: '<path d="M20 12 12 20l-9-9V3h8l9 9Z"/><circle cx="7" cy="7" r="1.4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  mapPin: '<path d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  truck: '<path d="M1 3h14v13H1z"/><path d="M15 8h4l3 3v5h-7"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  factory: '<path d="M3 21V10l6 4V10l6 4V4h3v17H3Z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
  sparkles: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/><path d="M5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6L5 3Z"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
};

function icon(name, cls = '') {
  const path = ICON_PATHS[name] || ICON_PATHS.dot;
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

function agentAvatar(agentId, size = '') {
  const agent = AGENTS.find((a) => a.id === agentId) || AGENTS[0];
  return `<span class="avatar ${size} agent" style="background:linear-gradient(145deg,${agent.color},${shade(agent.color, -18)})" title="${esc(agent.name)}">${esc(agent.initials)}</span>`;
}

function shade(hex, percent) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `#${(0x1000000 + Math.round((t - r) * p + r) * 0x10000 + Math.round((t - g) * p + g) * 0x100 + Math.round((t - b) * p + b)).toString(16).slice(1)}`;
}

/* ─────────────────────────────────────────────────────────────
   3. Utilidades
   ───────────────────────────────────────────────────────────── */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const attr = esc;
const nl2br = (value) => esc(value).replace(/\r?\n/g, '<br>');
const arr = (value) => Array.isArray(value) ? value : [];
const obj = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value, fallback = 'sin dato') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
const truncate = (value, max = 160) => {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}”¦` : s;
};

function money(value, currency = 'USD') {
  const n = num(value, 0);
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  } catch {
    const digits = Number.isInteger(n) ? 0 : 2;
    return `${currency || 'USD'} ${n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  }
}
function numFmt(value) {
  return num(value, 0).toLocaleString('es-AR');
}
function dateShort(value) {
  if (!value) return 'sin fecha';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'sin fecha';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(d);
}
function dateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
}
function relTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  const hour = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);
  let label;
  if (min < 1) label = 'ahora';
  else if (min < 60) label = `${min} min`;
  else if (hour < 24) label = `${hour} h`;
  else if (day < 30) label = `${day} d`;
  else label = dateShort(value);
  if (label === 'ahora') return label;
  return diff < 0 ? `hace ${label}` : `en ${label}`;
}
function initials(name) {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function safeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}
function mediaUrl(file) {
  if (!file) return '';
  return `/media/${String(file).split('/').map(encodeURIComponent).join('/')}`;
}
function agentById(id) { return AGENTS.find((a) => a.id === id) || AGENTS[0]; }
function missionStatusBadge(status, mission = null) {
  const finished = ['done', 'done_with_warnings'].includes(status);
  const noProspects = finished && mission && !mission.demo && num(mission.stats?.prospects) === 0;
  const tone = status === 'error' ? 'danger' : status === 'running' ? 'amber' : status === 'cancelled' ? 'neutral' : noProspects ? 'warn' : finished ? 'ok' : 'info';
  const label = noProspects ? 'Sin compradores' : (MISSION_STATUS[status] || status);
  return `<span class="badge badge-${tone}">${status === 'running' ? '<span class="dot dot-warn pulse"></span>' : ''}${(status === 'done_with_warnings' || noProspects) ? '<span class="dot dot-warn"></span>' : ''}${esc(label)}</span>`;
}
function stageBadge(stage) {
  return `<span class="badge badge-${STAGE_TONE[stage] || 'neutral'} badge-stage">${esc(STAGES[stage] || stage || 'Nuevo')}</span>`;
}
function demoBadge(isDemo) { return isDemo ? '<span class="badge badge-demo">Ejemplo</span>' : ''; }
function emptyState({ iconName = 'sun', title, text: body, actions = '' }) {
  return `<div class="empty">
    <div class="empty-illustration">${icon(iconName)}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
    ${actions ? `<div class="empty-actions">${actions}</div>` : ''}
  </div>`;
}
function placeholderLamp(extra = '') {
  return `<div class="photo-placeholder ${extra}">
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <circle cx="60" cy="52" r="34" stroke="#60a5fa" stroke-opacity=".22"/>
      <path d="M38 66h44L70 34H50L38 66Z" fill="#60a5fa" fill-opacity=".92"/>
      <path d="M60 66v28" stroke="#60a5fa" stroke-opacity=".55" stroke-width="2"/>
      <path d="M46 97h28" stroke="#60a5fa" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
      <circle cx="60" cy="71" r="3" fill="#eff6ff"/>
    </svg>
  </div>`;
}
function productImage(product) {
  const photo = arr(product?.photos)[0];
  if (photo?.file) return `<img src="${attr(mediaUrl(photo.file))}" alt="${attr(photo.alt || product.name || 'Lámpara')}" loading="lazy">`;
  return placeholderLamp();
}
function productThumb(product, cls = '') {
  if (!product) return `<span class="avatar sm ${cls}">?</span>`;
  const photo = arr(product.photos)[0];
  if (photo?.file) return `<img class="thumb-img ${cls}" src="${attr(mediaUrl(photo.file))}" alt="${attr(product.name)}" style="width:38px;height:38px;border-radius:10px;object-fit:cover;border:1px solid var(--line)">`;
  return `<span class="avatar sm ${cls}">${esc(initials(product.name))}</span>`;
}
function fieldValue(settings, path, fallback = '') {
  return path.split('.').reduce((acc, key) => acc?.[key], settings) ?? fallback;
}
function sortByDate(list, key = 'createdAt', dir = -1) {
  return [...list].sort((a, b) => (new Date(a[key] || 0).getTime() - new Date(b[key] || 0).getTime()) * dir);
}
function rangeDays(days) {
  return days.map((d) => esc(text(d))).join(' · ');
}

/* ─────────────────────────────────────────────────────────────
   4. Estado de la aplicación
   ───────────────────────────────────────────────────────────── */

const S = {
  state: null,
  connections: null,
  autopilot: null,
  route: { view: 'panel', id: null, query: new URLSearchParams() },
  mission: null,
  missionES: null,
  missionPoll: null,
  thread: null,
  latestPlan: null,
  wizard: null,
  ui: {
    productQuery: '',
    productStatus: 'todos',
    selectedProducts: [],
    inboxFilter: 'todos',
    inboxQuery: '',
    threadDraftEdit: null,
    contentFilter: 'todos',
    contentPlatform: 'todas',
    contentProduct: 'todos',
    connGoal: '',
    connResult: '',
    settingsTab: 'marca',
    openSteps: new Set(),
    ask: { agentId: 'director', question: '', result: null, loading: false },
    productPhotos: [],
    productEditId: null,
    onboardingShown: false,
    welcomeDismissed: false,
  },
};

function currentProductForMission() {
  if (!S.wizard) return null;
  return S.state?.products.find((p) => p.id === S.wizard.productId) || null;
}

/* ─────────────────────────────────────────────────────────────
   5. API y feedback
   ───────────────────────────────────────────────────────────── */

let saveTimer = null;
function setSaveState(kind, message = '') {
  const el = $('#save-state');
  if (!el) return;
  clearTimeout(saveTimer);
  el.className = `save-state ${kind}`;
  el.textContent = message || (kind === 'saving' ? 'Guardando”¦' : kind === 'saved' ? 'Guardado' : kind === 'error' ? 'Error al guardar' : '');
  if (kind === 'saved') saveTimer = setTimeout(() => { el.textContent = ''; el.className = 'save-state'; }, 2600);
}

async function api(path, options = {}) {
  const { method = 'GET', body, headers = {}, silent = false, raw = false } = options;
  if (!silent) setSaveState('saving');
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    if (body instanceof Blob || body instanceof FormData || body instanceof ArrayBuffer || typeof body === 'string') {
      init.body = body;
    } else {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  let response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (!silent) setSaveState('error');
    throw new Error('No pude conectarme con el servidor de Lucian. Revisá que la ventana negra siga abierta.');
  }
  if (raw) {
    if (!silent) setSaveState(response.ok ? 'saved' : 'error');
    return response;
  }
  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    data = await response.text();
  }
  if (!response.ok) {
    if (!silent) setSaveState('error');
    const message = typeof data === 'object' ? data.error : String(data || '');
    const error = new Error(message || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (!silent) setSaveState('saved');
  return data;
}

function toast(message, type = 'ok') {
  const root = $('#toasts');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'sun' : 'check')}<div class="toast-text">${esc(message)}</div><button class="toast-close" type="button" aria-label="Cerrar">${icon('x')}</button>`;
  el.querySelector('.toast-close').addEventListener('click', () => el.remove());
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, type === 'error' ? 7000 : 4200);
}

async function copyToClipboard(value, successMessage = 'Copiado.') {
  const s = String(value ?? '');
  if (!s) { toast('No hay texto para copiar.', 'info'); return; }
  try {
    await navigator.clipboard.writeText(s);
    toast(successMessage);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(successMessage); } catch { toast('No pude copiar. Seleccioná el texto a mano.', 'error'); }
    ta.remove();
  }
}

/* ─────────────────────────────────────────────────────────────
   6. Modales y confirmaciones
   ───────────────────────────────────────────────────────────── */

let confirmResolve = null;

function openModal({ title, subtitle = '', body = '', footer = '', size = '', onMount = null, closable = true }) {
  closeModal(true);
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${attr(title)}">
    <div class="modal ${size}">
      <div class="modal-head">
        <div class="modal-head-text">
          <h2 class="modal-title">${esc(title)}</h2>
          ${subtitle ? `<p class="modal-sub">${esc(subtitle)}</p>` : ''}
        </div>
        ${closable ? `<button class="icon-btn modal-close" type="button" data-action="close-modal" aria-label="Cerrar">${icon('x')}</button>` : ''}
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>
  </div>`;
  document.body.classList.add('modal-open');
  const backdrop = $('.modal-backdrop', root);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop && closable) closeModal();
  });
  const firstInput = root.querySelector('input:not([type="hidden"]), textarea, select');
  if (firstInput) setTimeout(() => firstInput.focus(), 80);
  if (onMount) onMount(root);
}

function closeModal(silent = false) {
  const root = $('#modal-root');
  if (!root) return;
  root.innerHTML = '';
  document.body.classList.remove('modal-open');
  if (confirmResolve && !silent) {
    confirmResolve(false);
    confirmResolve = null;
  }
}

function confirmAction({ title, message, details = '', confirmLabel = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    openModal({
      title,
      size: 'modal-sm',
      body: `<p style="font-size:13.5px;line-height:1.6;color:var(--ink-2)">${nl2br(message)}</p>${details ? `<div class="artifact-callout ${danger ? 'danger' : 'warn'} mt-3">${nl2br(details)}</div>` : ''}`,
      footer: `<button class="btn btn-ghost" type="button" data-action="confirm-no">Cancelar</button>
        <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" type="button" data-action="confirm-yes">${esc(confirmLabel)}</button>`,
      onMount: () => { confirmResolve = resolve; },
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   7. Carga de estado, ruta y shell
   ───────────────────────────────────────────────────────────── */

async function loadState({ render: shouldRender = true, silent = false } = {}) {
  try {
    S.state = await api('/api/state', { silent });
    S.loginAttempted = false;
    updateShell();
    scheduleAutoRefresh();
    if (shouldRender) render();
    maybeShowWelcome();
  } catch (error) {
    if (error.status === 401 && !S.loginAttempted) {
      S.loginAttempted = true;
      const token = window.prompt('Lucian está protegido. Escribí la clave que aparece en la PC del servidor:');
      if (token) {
        try {
          const response = await fetch('/api/login', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          if (response.ok) return loadState({ render: shouldRender, silent });
          renderFatal(new Error('Clave incorrecta. Recargá la página para volver a intentarlo.'));
          return;
        } catch { /* mostrar el error sin filtrar la clave */ }
      }
    }
    renderFatal(error);
  }
}

function renderFatal(error) {
  const view = $('#contenido');
  if (!view) return;
  view.innerHTML = `<div class="empty">
    <div class="empty-illustration">${icon('alert')}</div>
    <h3>No pude cargar Lucian</h3>
    <p>${esc(error.message || 'Error inesperado.')}</p>
    <div class="empty-actions"><button class="btn btn-primary" type="button" data-action="reload-state">${icon('refresh')} Reintentar</button></div>
  </div>`;
}

function routeParts() {
  const raw = (location.hash || '#/panel').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const parts = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  return { view: parts[0] || 'panel', id: parts[1] || null, query: new URLSearchParams(queryPart || '') };
}

function navigate(hash) {
  if (location.hash === hash) { render(); return; }
  location.hash = hash;
}

const VIEW_META = {
  panel: ['Hoy', 'Tu centro de operaciones'],
  productos: ['Productos', 'Tu catálogo'],
  producto: ['Lámpara', 'La ruta completa del producto'],
  misiones: ['Misiones', 'El equipo en acción'],
  ventas: ['Ventas', 'Lo vendido y lo que está por cerrar'],
  bandeja: ['Conversaciones', 'Compradores reales, no leads'],
  contenido: ['Contenido', 'Narrativa y redes'],
  equipo: ['Equipo', 'Once especialistas'],
  mercados: ['Mercados', 'Inteligencia acumulada'],
  conexiones: ['Conexiones', 'Estado de tus integraciones'],
  ajustes: ['Ajustes', 'Tu sistema'],
};

function updateShell() {
  if (!S.state) return;
  const { view } = S.route;
  $$('.nav-item, .mobile-nav a, .mobile-drawer-panel > a').forEach((el) => {
    const target = el.dataset.nav;
    el.classList.toggle('active', target === view || (view === 'bandeja' && target === 'bandeja'));
  });
  const counts = S.state.counts || {};
  const countMap = {
    products: counts.products,
    activeMissions: counts.activeMissions,
    drafts: counts.drafts,
    contentIdeas: counts.contentIdeas,
    sold: S.state.sales?.sold || 0,
  };
  $$('[data-count]').forEach((el) => {
    const value = countMap[el.dataset.count] || 0;
    el.textContent = value > 99 ? '99+' : String(value);
    el.classList.toggle('show', value > 0);
    el.classList.toggle('hot', el.dataset.count === 'drafts' && value > 0);
  });

  const modeCard = $('#mode-card');
  const title = $('#mode-title');
  const sub = $('#mode-sub');
  if (S.state.flags?.ai) {
    modeCard?.classList.add('live');
    if (title) title.textContent = 'IA conectada';
    if (sub) sub.textContent = `${S.state.flags.aiProvider || 'proveedor'} · las misiones corren con datos reales.`;
  } else {
    modeCard?.classList.remove('live');
    if (title) title.textContent = 'Modo demo';
    if (sub) sub.textContent = 'Configurá una IA para trabajar con datos reales.';
  }

  const meta = VIEW_META[view] || VIEW_META.panel;
  $('#topbar-title').textContent = meta[0];
  $('#topbar-eyebrow').textContent = meta[1];
  $('#footer-version').textContent = `v${S.state.app?.version || '1.0'}`;
  const quickDemo = $('#quick-demo');
  if (quickDemo) quickDemo.style.display = S.state.counts?.products ? 'none' : '';

  if (view === 'misiones' && S.route.id && S.route.id !== 'nueva' && S.mission?.mission?.name) {
    $('#topbar-title').textContent = S.mission.mission.name;
  }
  if (view === 'bandeja' && S.route.id && S.thread?.thread?.contact?.company) {
    $('#topbar-title').textContent = S.thread.thread.contact.company;
  }
  if (view === 'producto' && S.route.id) {
    const product = arr(S.state.products).find((p) => p.id === S.route.id);
    if (product) $('#topbar-title').textContent = product.name;
  }
}

function render() {
  if (!S.state) return;
  const next = routeParts();
  const changedView = next.view !== S.route.view;
  S.route = next;
  if (next.view !== 'misiones' || next.id === 'nueva') disconnectMission();
  updateShell();
  const view = $('#contenido');
  if (!view) return;
  let html = '';
  try {
    switch (next.view) {
      case 'panel': html = renderPanel(); break;
      case 'productos': html = next.id ? renderProductRoute(next.id) : renderProducts(); break;
      case 'misiones': html = next.id === 'nueva' ? renderWizard() : next.id ? renderMissionView(next.id) : renderMissions(); break;
      case 'ventas': html = renderVentas(); break;
      case 'bandeja': html = renderInbox(next.id); break;
      case 'contenido': html = renderContent(); break;
      case 'equipo': html = renderTeam(); break;
      case 'mercados': html = renderMarkets(); break;
      case 'conexiones': html = renderConnections(); break;
      case 'ajustes': html = renderSettings(); break;
      default: html = emptyState({ iconName: 'sun', title: 'Esa página no existe', text: 'Volvé al panel para seguir.', actions: '<a class="btn btn-primary" href="#/panel">Ir al panel</a>' });
    }
  } catch (error) {
    console.error(error);
    html = `<div class="empty"><div class="empty-illustration">${icon('alert')}</div><h3>Algo se rompió al dibujar esta pantalla</h3><p>${esc(error.message)}</p></div>`;
  }
  view.innerHTML = `<div class="fade-in">${html}</div>`;
  view.setAttribute('tabindex', '-1');
  if (changedView) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  bindView(next);
}

function scheduleAutoRefresh() {
  clearInterval(S.autoRefresh);
  const active = S.state?.counts?.activeMissions || 0;
  if (active > 0) {
    S.autoRefresh = setInterval(async () => {
      try {
        const fresh = await api('/api/state', { silent: true });
        S.state = fresh;
        updateShell();
        if (S.route.view === 'panel' || S.route.view === 'misiones') render();
        if (!fresh.counts.activeMissions) scheduleAutoRefresh();
      } catch { /* silencio */ }
    }, 5000);
  }
}

function maybeShowWelcome() {
  const onboarding = S.state?.onboarding;
  if (!onboarding || onboarding.done || S.ui.welcomeDismissed || S.ui.onboardingShown) return;
  if (document.body.classList.contains('modal-open')) return;
  S.ui.onboardingShown = true;
  const products = S.state.counts?.products || 0;
  const demoLoaded = Boolean(onboarding.demoLoaded);
  openModal({
    title: 'Bienvenido a Lucian',
    subtitle: 'El equipo comercial de un maker de lámparas. Sin planillas y sin depender de Airtable.',
    size: 'modal-lg',
    body: `<div style="display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:center">
      <div>
        <p class="eyebrow">Empezar</p>
        <p style="font-family:var(--serif);font-size:30px;line-height:1.12;margin-top:7px;letter-spacing:-.02em">Subí una lámpara.<br>El equipo hace el resto.</p>
        <p style="color:var(--ink-3);font-size:13px;line-height:1.6;margin-top:12px">Lucian investiga el mercado, calcula aduanas y precios, busca compradores, escribe los mensajes y arma el contenido. Vos revisás y decidís qué se envía.</p>
        <div class="onboard-steps" style="margin-top:16px">
          <span class="onboard-step"><span class="num">1</span> Cargá tu lámpara</span>
          <span class="onboard-step"><span class="num">2</span> Lanzá la misión</span>
          <span class="onboard-step"><span class="num">3</span> Revisá y enviá</span>
        </div>
      </div>
      <div style="border-radius:18px;background:linear-gradient(150deg,#0b1220,#111a2e);padding:24px;display:grid;place-items:center;min-height:210px">
        <svg viewBox="0 0 140 150" fill="none" style="width:150px;filter:drop-shadow(0 15px 22px rgba(0,0,0,.3))">
          <circle cx="70" cy="60" r="46" fill="#60a5fa" fill-opacity=".1"/>
          <path d="M44 78h52L86 36H54L44 78Z" fill="#60a5fa"/>
          <path d="M70 78v36" stroke="#3b82f6" stroke-width="2.5"/>
          <path d="M53 117h34" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="70" cy="84" r="4" fill="#eff6ff"/>
          <path d="M70 12v8M26 34l6 5M114 34l-6 5" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" opacity=".7"/>
        </svg>
      </div>
    </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="welcome-demo">${demoLoaded ? 'Seguir con los ejemplos' : 'Ver con datos de ejemplo'}</button>
      <button class="btn btn-ghost" type="button" data-action="welcome-skip">Solo mirar</button>
      <button class="btn btn-primary" type="button" data-action="welcome-start">${products ? 'Cargar otra lámpara' : 'Cargar mi primera lámpara'}</button>`,
  });
}

/* ─────────────────────────────────────────────────────────────
   8. Panel
   ───────────────────────────────────────────────────────────── */

function panelSalesHTML() {
  const sales = S.state.sales || {};
  const won = arr(sales.won);
  if (!won.length) {
    return `<section class="section">
      <div class="section-head">
        <div><h2 class="section-title">Ventas</h2><p class="section-sub">Todavía no hay ventas cerradas. Cuando aceptes una cotización o marques una conversación como Ganada, aparece acá.</p></div>
        <a class="section-link" href="#/ventas">Ver ventas ${icon('arrowRight')}</a>
      </div>
      <div class="card card-pad" style="text-align:center">
        <p class="muted small">Las cotizaciones abiertas y los ingresos los ves en la vista de Ventas. Aceptar una cotización no confirma un pago. Los cobros se registran manualmente.</p>
      </div>
    </section>`;
  }
  return `<section class="section">
    <div class="section-head">
      <div><h2 class="section-title">Ventas recientes</h2><p class="section-sub">${won.length} venta${won.length === 1 ? '' : 's'} · ${money(sales.revenue || 0, sales.currency)} informados manualmente (no conciliados).</p></div>
      <a class="section-link" href="#/ventas">Ver todas ${icon('arrowRight')}</a>
    </div>
    <div class="card" style="padding:6px 0">
      ${won.slice(0, 4).map((w) => `<a class="thread-row" href="#/bandeja/${encodeURIComponent(w.threadId)}" style="text-decoration:none">
        <div class="thread-row-top">
          <span class="avatar sm">${esc(initials(w.company || '?'))}</span>
          <div style="min-width:0;flex:1">
            <div class="thread-company">${esc(w.company)} <span class="badge badge-ok">Ganada</span></div>
            <div class="thread-person">${esc(w.productName)}${w.quoteNumber ? ` · ${esc(w.quoteNumber)}` : ''}</div>
          </div>
          <b style="color:var(--ok)">${esc(money(w.total, w.currency))}</b>
        </div>
        <div class="thread-preview">${esc(w.acceptedAt ? `Cerrada ${relTime(w.acceptedAt)}` : 'Venta cerrada')}</div>
      </a>`).join('')}
    </div>
  </section>`;
}

function panelDecisionsHTML() {
  const threads = arr(S.state.threads);
  const reviewThreads = threads.filter((t) => num(t.reviewCount) > 0).slice(0, 5);
  const inbound = threads.filter((t) => t.awaitingReply).slice(0, 4);
  if (!reviewThreads.length && !inbound.length) return '';
  return `<section class="section" style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px">
    ${reviewThreads.length ? `<div>
      <div class="section-head"><div><h2 class="section-title">Para aprobar</h2><p class="section-sub">${reviewThreads.length} conversación${reviewThreads.length === 1 ? '' : 'es'} con borradores por revisar.</p></div><a class="section-link" href="#/bandeja?filtro=revisar">Ver todas ${icon('arrowRight')}</a></div>
      <div class="card" style="padding:6px 0">
        ${reviewThreads.map((t) => `<a class="thread-row" href="#/bandeja/${encodeURIComponent(t.id)}" style="text-decoration:none">
          <div class="thread-row-top">
            <span class="avatar sm">${esc(initials(t.contact?.company || '?'))}</span>
            <div style="min-width:0;flex:1">
              <div class="thread-company">${esc(t.contact?.company || 'Contacto')} <span class="badge badge-warn">${t.reviewCount} por aprobar</span></div>
              <div class="thread-person">${esc(truncate(t.draftPreview?.subject || t.nextStep || 'Borrador pendiente', 60))}</div>
            </div>
            <span class="thread-score">${esc(t.score || 0)}</span>
          </div>
        </a>`).join('')}
      </div>
    </div>` : '<div></div>'}
    ${inbound.length ? `<div>
      <div class="section-head"><div><h2 class="section-title">Te escribieron</h2><p class="section-sub">${inbound.length} respuesta${inbound.length === 1 ? '' : 's'} por leer.</p></div><a class="section-link" href="#/bandeja?filtro=responder">Ver todas ${icon('arrowRight')}</a></div>
      <div class="card" style="padding:6px 0">
        ${inbound.map((t) => `<a class="thread-row" href="#/bandeja/${encodeURIComponent(t.id)}" style="text-decoration:none">
          <div class="thread-row-top">
            <span class="avatar sm">${esc(initials(t.contact?.company || '?'))}</span>
            <div style="min-width:0;flex:1">
              <div class="thread-company">${esc(t.contact?.company || 'Contacto')} ${t.demo ? '<span class="badge badge-demo">Ejemplo</span>' : '<span class="badge badge-ok">Real</span>'}</div>
              <div class="thread-person">${esc(truncate(t.lastMessage?.body || '', 70))}</div>
            </div>
            <span class="thread-score">${esc(t.score || 0)}</span>
          </div>
        </a>`).join('')}
      </div>
    </div>` : '<div></div>'}
  </section>`;
}

function renderPanel() {
  const s = S.state;
  const brand = s.brand || {};
  const counts = s.counts || {};
  const active = arr(s.missions).find((m) => ['running', 'queued'].includes(m.status));
  const products = arr(s.products);
  const threads = arr(s.threads);
  const hotThreads = [...threads].filter((t) => ['interesado', 'negociando', 'respondio'].includes(t.stage)).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 4);
  const latestMissions = [...arr(s.missions)].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3);
  const activeProduct = active ? products.find((p) => p.id === active.productId) : null;
  const hasProducts = products.length > 0;
  const missingBrand = !brand.maker || (!brand.website && !brand.instagram) || !brand.email;
  const onboardingDone = s.onboarding?.done;

  const heroTitle = active
    ? `El equipo está trabajando en <em>${esc(activeProduct?.name || active.name)}</em>.`
    : hasProducts
      ? `Tu lámpara ya tiene <em>comprador</em>. Falta encontrarlo.`
      : `Tu próxima venta empieza con <em>una foto</em>.`;
  const heroSub = active
    ? `La misión avanza paso a paso. Podés entrar a la sala, leer lo que produce cada especialista y cancelar si algo no te cierra.`
    : hasProducts
      ? `Lucian investiga el mercado, calcula aduanas y precios, busca compradores concretos y deja los mensajes listos para que los revises. Vos decidís qué se envía.`
      : `Cargá una lámpara con sus fotos, precio y notas. El equipo arma el plan comercial completo: a quién venderle, a qué precio, con qué mensaje y qué contenido.`;

  const onboardBanner = !onboardingDone
    ? `<div class="onboard">
        <div>
          <h2>Poné Lucian a tu nombre</h2>
          <p>Completá tu marca y tu correo para que los mensajes salgan con tu identidad, no con datos de ejemplo.</p>
          <div class="onboard-steps">
            <span class="onboard-step ${brand.name ? 'done' : ''}"><span class="num">${brand.name ? '✓' : '1'}</span> Nombre de marca</span>
            <span class="onboard-step ${brand.maker ? 'done' : ''}"><span class="num">${brand.maker ? '✓' : '2'}</span> Quién está detrás</span>
            <span class="onboard-step ${brand.email ? 'done' : ''}"><span class="num">${brand.email ? '✓' : '3'}</span> Correo de contacto</span>
          </div>
        </div>
        <div class="onboard-actions"><a class="btn btn-ghost btn-sm" href="#/ajustes?tab=marca">Completar marca</a></div>
      </div>`
    : missingBrand && (hasProducts || arr(s.missions).length)
      ? `<div class="onboard">
          <div><h2 class="card-title">Faltan datos de tu marca</h2><p>Sin tu nombre, ciudad y web, los mensajes pierden confianza. Se completan en un minuto.</p></div>
          <div class="onboard-actions"><a class="btn btn-ghost btn-sm" href="#/ajustes?tab=marca">Completar ahora</a></div>
        </div>`
      : '';

  return `
    ${onboardBanner}
    <section class="hero">
      <div class="hero-copy">
        <span class="hero-kicker"><span class="dot"></span>${esc(brand.name || 'Lucian')} · ${esc(brand.city || 'atelier digital')}</span>
        <h2 class="hero-title">${heroTitle}</h2>
        <p class="hero-sub">${heroSub}</p>
        <div class="hero-actions">
          ${active
            ? `<a class="btn btn-accent" href="#/misiones/${encodeURIComponent(active.id)}">${icon('play')} Entrar a la sala</a>`
            : hasProducts
              ? `<a class="btn btn-accent" href="#/misiones/nueva">${icon('spark')} Lanzar una misión</a>`
              : `<button class="btn btn-accent" type="button" data-action="new-product">${icon('plus')} Cargar mi primera lámpara</button>`}
          ${hasProducts
            ? `<a class="btn btn-ghost" href="#/productos">${icon('box')} Ver productos</a>`
            : `<button class="btn btn-ghost" type="button" data-action="demo-seed">${icon('sun')} Ver con datos de ejemplo</button>`}
        </div>
        <div class="hero-meta">
          <span><b>11</b> especialistas</span>
          <span><b>0</b> planillas</span>
          <span><b>100%</b> en tu computadora</span>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-glow"></div>
        <div class="hero-lamp">
          <svg viewBox="0 0 200 230" fill="none">
            <path d="M64 116h72L120 46H80L64 116Z" fill="#60a5fa"/>
            <path d="M100 116v58" stroke="#3b82f6" stroke-width="3"/>
            <path d="M77 178h46" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
            <circle cx="100" cy="123" r="5" fill="#eff6ff"/>
            <path d="M100 20v10M40 48l8 7M160 48l-8 7M30 116h9M161 116h9" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>
            <ellipse cx="100" cy="188" rx="72" ry="9" fill="#60a5fa" opacity=".08"/>
          </svg>
        </div>
        <div class="hero-note">
          <b>${active ? 'Misión en curso' : s.latestPlan ? (arr(s.latestPlan.mission?.warnings).length ? 'Plan con avisos' : 'Plan listo') : 'Siguiente paso'}</b>
          ${active ? `${active.progress || 0}% completado · ${esc(active.currentStep || 'preparando')}` : s.latestPlan ? esc(truncate(s.latestPlan.decision || s.latestPlan.resumen, 90)) : 'Cargá una foto. El equipo hace el resto.'}
        </div>
      </div>
    </section>

    ${active ? activeMissionBanner(active) : ''}

    <section class="stat-grid">
      ${statCard('Por aprobar', counts.draftsToReview || 0, 'mail', counts.draftsToReview ? 'borradores esperando tu OK' : 'nada pendiente', '#/bandeja?filtro=revisar', counts.draftsToReview ? 'warm' : '')}
      ${statCard('Te escribieron', counts.awaitingReply || 0, 'message', counts.awaitingReply ? 'respuestas por leer' : 'sin novedades', '#/bandeja?filtro=responder', counts.awaitingReply ? 'warm' : '')}
      ${statCard('Ventas cerradas', S.state.sales?.sold || 0, 'dollar', S.state.sales?.revenue ? `${money(S.state.sales.revenue, S.state.sales.currency)} cobros informados` : 'todavía ninguna', '#/ventas', (S.state.sales?.sold || 0) ? 'warm' : '')}
      ${statCard('Piezas de contenido', counts.content || 0, 'image', 'ideas, borradores y publicadas', '#/contenido')}
    </section>

    ${panelSalesHTML()}
    ${panelDecisionsHTML()}

    <div class="section" style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(300px,.9fr);gap:22px">
      <div>
        <div class="section-head">
          <div><h2 class="section-title">Misiones</h2><p class="section-sub">Cada misión es una pasada completa del equipo.</p></div>
          <a class="section-link" href="#/misiones">Ver todas ${icon('arrowRight')}</a>
        </div>
        ${latestMissions.length
          ? `<div class="mission-list">${latestMissions.map(missionCard).join('')}</div>`
          : `<div class="card card-pad" style="text-align:center;padding:34px 20px">
              <p style="font-family:var(--serif);font-size:22px">Todavía no hay misiones.</p>
              <p class="muted small" style="margin-top:5px">Elegí una lámpara y contale al equipo qué querés conseguir.</p>
              <div class="cluster" style="justify-content:center;margin-top:14px">
                ${hasProducts ? `<a class="btn btn-primary btn-sm" href="#/misiones/nueva">${icon('spark')} Lanzar la primera</a>` : `<button class="btn btn-primary btn-sm" type="button" data-action="new-product">${icon('plus')} Cargar producto</button>`}
              </div>
            </div>`}
      </div>
      <div>
        <div class="section-head">
          <div><h2 class="section-title">Lo que pasó</h2><p class="section-sub">Sin ruido. Solo señales.</p></div>
        </div>
        <div class="card card-pad">
          ${arr(s.activity).length ? `<div class="activity">${arr(s.activity).slice(0, 8).map(activityRow).join('')}</div>` : '<p class="muted small">Las novedades del equipo van a aparecer acá.</p>'}
        </div>
      </div>
    </div>

    <div class="section" style="display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:22px">
      <div>
        <div class="section-head">
          <div><h2 class="section-title">Bandeja prioritaria</h2><p class="section-sub">Personas que ya mostraron interés.</p></div>
          <a class="section-link" href="#/bandeja">Abrir bandeja ${icon('arrowRight')}</a>
        </div>
        <div class="card" style="padding:6px 0">
          ${hotThreads.length
            ? hotThreads.map((t) => `
              <a class="thread-row" href="#/bandeja/${encodeURIComponent(t.id)}" style="text-decoration:none">
                <div class="thread-row-top">
                  <span class="avatar sm">${esc(initials(t.contact?.company || '?'))}</span>
                  <div style="min-width:0;flex:1">
                    <div class="thread-company">${esc(t.contact?.company || 'Contacto')} ${stageBadge(t.stage)}</div>
                    <div class="thread-person">${esc(t.contact?.name || '')}${t.contact?.country ? ` · ${esc(t.contact.country)}` : ''}</div>
                  </div>
                  <span class="thread-score">${t.score || 0}</span>
                </div>
                <div class="thread-preview ${t.lastMessage?.direction === 'in' ? 'in' : ''}">${esc(t.lastMessage?.body || t.draftPreview?.body || t.nextStep || 'Sin mensajes todavía.')}</div>
              </a>`).join('')
            : `<div style="padding:26px 20px;text-align:center"><p class="muted small">Todavía no hay conversaciones calientes. Las misiones crean la bandeja por vos.</p></div>`}
        </div>
      </div>
      <div>
        <div class="section-head">
          <div><h2 class="section-title">${s.latestPlan ? 'El plan de 7 días' : 'Cómo trabaja el equipo'}</h2><p class="section-sub">${s.latestPlan ? 'Lo que dejó la última misión.' : 'Once especialistas, una sola persona al mando.'}</p></div>
          ${s.latestPlan?.mission?.id ? `<a class="section-link" href="#/misiones/${encodeURIComponent(s.latestPlan.mission.id)}">Ver misión ${icon('arrowRight')}</a>` : ''}
        </div>
        ${s.latestPlan
          ? `<div class="card card-pad">
              <p class="eyebrow">Decisión</p>
              <p style="font-family:var(--serif);font-size:20px;line-height:1.35;margin-top:6px">${esc(s.latestPlan.decision || s.latestPlan.resumen || '')}</p>
              <div class="plan-days mt-3">
                ${arr(s.latestPlan.plan_7_dias).slice(0, 3).map((d, i) => `<div class="plan-day"><span class="plan-num">${esc(d.dia || i + 1)}</span><div class="plan-content"><h3>${esc(d.accion || '')}</h3><div class="plan-meta"><span>${esc(d.tiempo || '')}</span></div></div></div>`).join('')}
              </div>
            </div>`
          : `<div class="card card-pad">
              <div class="flow">
                ${['Brief', 'Mercado', 'Aduanas', 'Precios', 'Compradores', 'Mensajes', 'Contenido', 'Cumplimiento', 'Red team', 'Plan final'].map((step, i, list) => `<span class="flow-step"><b>${i + 1}</b>${step}</span>${i < list.length - 1 ? `<span class="flow-arrow">${icon('chevronRight')}</span>` : ''}`).join('')}
              </div>
              <p class="small muted" style="margin-top:8px;line-height:1.55">El equipo no escribe nada en tu nombre sin que lo revises. Cumplimiento y Abogado del Diablo están ahí para frenarte antes de una promesa riesgosa.</p>
              <a class="btn btn-ghost btn-sm mt-3" href="#/equipo">${icon('users')} Conocer al equipo</a>
            </div>`}
      </div>
    </div>

    <section class="section">
      <div class="section-head">
        <div><h2 class="section-title">El equipo</h2><p class="section-sub">No es un chatbot. Son roles con un trabajo distinto.</p></div>
        <a class="section-link" href="#/equipo">Ver los once ${icon('arrowRight')}</a>
      </div>
      <div class="team-grid">
        ${AGENTS.slice(0, 6).map(agentMiniCard).join('')}
      </div>
    </section>`;
}

function statCard(label, value, iconName, foot, href, extra = '') {
  return `<a class="stat ${extra}" href="${attr(href)}" style="text-decoration:none;color:inherit">
    <div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon">${icon(iconName)}</span></div>
    <div class="stat-value">${esc(value)}</div>
    <div class="stat-foot">${esc(foot)}</div>
  </a>`;
}

function activeMissionBanner(mission) {
  return `<div class="card" style="padding:13px 16px;margin-bottom:22px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:linear-gradient(100deg,#fff7e8,#fffaf1)">
    <span class="avatar sm agent" style="background:linear-gradient(145deg,#c98a3c,#9c6722)">${icon('spark')}</span>
    <div style="flex:1;min-width:200px">
      <div class="between"><b style="font-size:12.5px">${esc(mission.name)}</b><span class="small muted">${mission.progress || 0}%</span></div>
      <div class="progress mt-2"><div class="progress-bar" style="width:${Math.max(3, num(mission.progress))}%"></div></div>
    </div>
    <a class="btn btn-primary btn-sm" href="#/misiones/${encodeURIComponent(mission.id)}">Entrar a la sala ${icon('arrowRight')}</a>
  </div>`;
}

function missionCard(mission) {
  const product = S.state.products.find((p) => p.id === mission.productId);
  const steps = arr(mission.steps);
  return `<a class="mission-card" href="#/misiones/${encodeURIComponent(mission.id)}">
    <div style="min-width:0">
      <div class="mission-card-head">
        ${productThumb(product)}
        <h3>${esc(mission.name)}</h3>
        ${missionStatusBadge(mission.status, mission)}
        ${demoBadge(mission.demo)}
      </div>
      <div class="mission-card-sub">
        <span>${icon('target')} ${esc((mission.markets || []).join(' · ') || 'Sin mercados')}</span>
        <span>${icon('clock')} ${esc(relTime(mission.finishedAt || mission.startedAt || mission.createdAt))}</span>
        <span>${icon('spark')} ${esc(DEPTHS[mission.depth]?.label || mission.depth)}</span>
      </div>
      ${steps.length ? `<div class="mission-steps-mini">${steps.map((s) => `<span class="step-dot ${s.status === 'done' ? 'done' : s.status === 'running' ? 'running' : s.status === 'error' ? 'error' : ''}" title="${attr(s.title)}"></span>`).join('')}</div>` : ''}
    </div>
    <div class="mission-card-right">
      <div class="mission-card-progress">
        <div class="progress"><div class="progress-bar ${mission.status === 'done' ? 'ok' : mission.status === 'done_with_warnings' ? 'warn' : mission.status === 'error' ? 'danger' : ''}" style="width:${Math.max(2, num(mission.progress))}%"></div></div>
        <div class="progress-label"><span>${mission.status === 'error' ? 'Con error' : ['done', 'done_with_warnings'].includes(mission.status) ? (!mission.demo && num(mission.stats?.prospects) === 0 ? 'Sin compradores' : 'Terminada') : mission.status === 'done_with_warnings' ? 'Con avisos' : 'Avance'}</span><b>${mission.progress || 0}%</b></div>
      </div>
      ${icon('chevronRight')}
    </div>
  </a>`;
}

function activityRow(item) {
  const iconName = item.type === 'reply' ? 'message' : item.type === 'mission' ? 'spark' : item.type === 'outreach' ? 'send' : item.type === 'content' ? 'image' : item.type === 'product' ? 'box' : 'sun';
  return `<div class="activity-item">
    <span class="activity-icon ${esc(item.type || '')}">${icon(iconName)}</span>
    <div style="min-width:0"><div class="activity-text">${esc(item.text || '')}</div><div class="activity-time">${esc(relTime(item.at))} · ${esc(dateTime(item.at))}</div></div>
  </div>`;
}

function agentMiniCard(agent) {
  const usage = S.state?.usage?.[agent.id] || 0;
  return `<div class="agent-card" style="--agent-tint:${agent.color}22">
    <div class="agent-top">${agentAvatar(agent.id)}<div><div class="agent-name">${esc(agent.name)}</div><div class="agent-role">${esc(agent.role)}</div></div></div>
    <p class="agent-bio">${esc(truncate(agent.bio, 130))}</p>
    <div class="agent-focus">${agent.focus.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
    ${usage ? `<div class="agent-usage">${icon('spark')} <b>${usage}</b> participaciones</div>` : ''}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   9. Productos
   ───────────────────────────────────────────────────────────── */

function renderVentas() {
  const sales = S.state.sales || {};
  const currency = sales.currency || 'USD';
  const won = arr(sales.won);
  const open = arr(sales.open);
  const byProduct = arr(sales.byProduct);
  const agenda = S.state.salesAgenda || { tasks: [], total: 0, counts: {} };
  const agendaTasks = arr(agenda.tasks);
  const health = S.state.catalogHealth || { total: 0, ready: 0, blocked: 0, toImprove: [] };
  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Ventas</p>
      <h2 class="page-title">Lo vendido y lo que está por cerrar.</h2>
      <p class="page-sub">Cotizaciones aceptadas, cobros informados y saldos pendientes. Aceptar una propuesta NO acredita dinero; los cobros se registran manualmente y no se concilian con el banco.</p>
    </div>
    <div class="page-actions">
      <a class="btn btn-ghost btn-sm" href="#/bandeja?filtro=revisar">${icon('mail')} Por aprobar</a>
      <a class="btn btn-primary btn-sm" href="#/bandeja">${icon('inbox')} Conversaciones</a>
    </div>
  </div>

  <section class="stat-grid">
    ${statCard('Ventas cerradas', sales.sold || 0, 'dollar', sales.sold ? 'conversaciones ganadas' : 'todavía ninguna', '', sales.sold ? 'warm' : '')}
    ${statCard('Cobros informados', money(sales.revenue || 0, currency), 'chart', 'manual · sin conciliación bancaria', '', '')}
    ${statCard('Cotizaciones abiertas', sales.openQuotes || 0, 'mail', open.length ? 'borrador o enviada' : 'ninguna', '', sales.openQuotes ? 'warm' : '')}
    ${statCard('Cotizaciones aceptadas', sales.acceptedQuotes || 0, 'check', `${sales.unpaidAcceptedQuotes || 0} con saldo pendiente`, '', '')}
  </section>

  <section class="section" id="agenda-comercial">
    <div class="section-head">
      <div><h2 class="section-title">Agenda comercial priorizada</h2><p class="section-sub">Qué conviene revisar primero para avanzar ventas reales. No envía mensajes ni acredita cobros.</p></div>
      <span class="badge badge-info">${num(agenda.total)} tarea${num(agenda.total) === 1 ? '' : 's'}</span>
    </div>
    ${agendaTasks.length ? `<div class="card" style="padding:6px 0">
      ${agendaTasks.map((task) => `<a class="thread-row" href="#/bandeja/${encodeURIComponent(task.threadId)}" style="text-decoration:none">
        <div class="thread-row-top">
          <span class="avatar sm">${esc(initials(task.company || '?'))}</span>
          <div style="min-width:0;flex:1">
            <div class="thread-company">${esc(task.company)} <span class="badge badge-${task.priority >= 85 ? 'warn' : 'info'}">${esc(task.title)}</span></div>
            <div class="thread-person">${esc(task.productName)}${task.amount > 0 ? ` · Saldo: ${esc(money(task.amount, task.currency))}` : ''}</div>
          </div>
          ${icon('chevronRight')}
        </div>
        <div class="thread-preview">${esc(task.detail)}</div>
      </a>`).join('')}
    </div>
    ${agenda.total > agendaTasks.length ? `<p class="tiny muted mt-2">Mostrando las ${agendaTasks.length} prioridades principales de ${num(agenda.total)}. Revisá el resto desde Conversaciones.</p>` : ''}` : `<div class="card card-pad"><p class="small muted">No hay tareas urgentes detectadas con los datos actuales. Revisá los contactos verificados y las propuestas antes de iniciar nuevos seguimientos.</p></div>`}
  </section>

  <section class="section" id="estado-catalogo">
    <div class="section-head">
      <div><h2 class="section-title">Preparación del catálogo para vender</h2><p class="section-sub">Las misiones reales requieren una imagen cargada y un precio mayor a cero. Los otros datos mejoran las propuestas y la logística.</p></div>
      <a class="section-link" href="#/productos">Ver las lámparas ${icon('arrowRight')}</a>
    </div>
    <div class="card card-pad">
      <p class="small"><b>${num(health.ready)} de ${num(health.total)}</b> lámparas activas cumplen los requisitos mínimos para iniciar misiones. <b>${num(health.blocked)}</b> requieren completar foto o precio.</p>
      <p class="tiny muted mt-2">Sin foto cargada: ${num(health.missingPhotos)} · Sin precio: ${num(health.missingPrices)}. Esta comprobación no valida la calidad de la imagen, la capacidad de fabricación ni certificaciones eléctricas.</p>
      ${arr(health.toImprove).length ? `<div style="margin-top:10px">
        ${arr(health.toImprove).map((item) => `<a class="thread-row" href="#/productos/${encodeURIComponent(item.id)}" style="text-decoration:none">
          <div class="thread-row-top">
            <span class="avatar sm">${esc(initials(item.name || '?'))}</span>
            <div style="min-width:0;flex:1">
              <div class="thread-company">${esc(item.name)} <span class="badge badge-${item.readyForProspecting ? 'info' : 'warn'}">${item.readyForProspecting ? 'Mejorable' : 'Requiere completar'}</span></div>
              <div class="thread-person">${esc((item.criticalMissing.length ? item.criticalMissing : item.recommendedMissing).slice(0, 2).join(' · '))}</div>
            </div>
            <span class="tiny muted">${num(item.score)}%</span>
          </div>
        </a>`).join('')}
      </div>` : '<p class="tiny muted mt-2">Todas las fichas activas cumplen los requisitos revisados.</p>'}
    </div>
  </section>

  <div class="section" style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(300px,1fr);gap:22px">
    <div>
      <div class="section-head">
        <div><h2 class="section-title">Ventas cerradas</h2><p class="section-sub">Cada fila es una conversación en etapa Ganada. El monto sale de la cotización aceptada.</p></div>
      </div>
      ${won.length ? `<div class="card" style="padding:6px 0">
        ${won.map((w) => `<a class="thread-row" href="#/bandeja/${encodeURIComponent(w.threadId)}" style="text-decoration:none">
          <div class="thread-row-top">
            <span class="avatar sm">${esc(initials(w.company || '?'))}</span>
            <div style="min-width:0;flex:1">
              <div class="thread-company">${esc(w.company)} <span class="badge badge-ok">Ganada</span></div>
              <div class="thread-person">${esc(w.productName)}${w.quoteNumber ? ` · ${esc(w.quoteNumber)}` : ''}</div>
            </div>
            <b style="color:var(--ok)">${esc(money(w.total, w.currency))}</b>
          </div>
          <div class="thread-preview">${esc(w.acceptedAt ? `Cerrada ${relTime(w.acceptedAt)} · ${dateTime(w.acceptedAt)}` : 'Venta cerrada')}</div>
        </a>`).join('')}
      </div>` : `<div class="card card-pad" style="text-align:center"><p class="muted small">Todavía no hay ventas. Marcá una conversación como Ganada o aceptá una cotización.</p></div>`}
    </div>
    <div>
      <div class="section-head">
        <div><h2 class="section-title">Cotizaciones abiertas</h2><p class="section-sub">Borrador o enviada: todavía no cerraron.</p></div>
      </div>
      ${open.length ? `<div class="card" style="padding:6px 0">
        ${open.slice(0, 10).map((q) => `<a class="thread-row" href="#/bandeja/${encodeURIComponent(q.threadId)}" style="text-decoration:none">
          <div class="thread-row-top">
            <span class="avatar sm">${esc(initials(q.company || '?'))}</span>
            <div style="min-width:0;flex:1">
              <div class="thread-company">${esc(q.company)} <span class="badge badge-neutral">${esc(q.statusLabel)}</span></div>
              <div class="thread-person">${esc(q.productName)} · ${esc(q.number)}</div>
            </div>
            <b>${esc(money(q.total, q.currency))}</b>
          </div>
          <div class="thread-preview">${esc(q.createdAt ? `Preparada ${relTime(q.createdAt)}` : '')}</div>
        </a>`).join('')}
      </div>` : `<div class="card card-pad" style="text-align:center"><p class="muted small">Sin cotizaciones abiertas. Preparalas desde una conversación.</p></div>`}
    </div>
  </div>

  ${byProduct.length ? `<section class="section">
    <div class="section-head">
      <div><h2 class="section-title">Por lámpara</h2><p class="section-sub">Cotizaciones y cobros manualmente registrados por producto. Hacé clic para ver el detalle.</p></div>
    </div>
    <div class="card" style="padding:6px 0">
      ${byProduct.sort((a,b) => (b.revenue||0)-(a.revenue||0)).map((p) => `<a class="thread-row" href="#/productos/${encodeURIComponent(p.productId)}" style="text-decoration:none">
        <div class="thread-row-top">
          <span class="avatar sm">${esc(initials(p.productName || '?'))}</span>
          <div style="min-width:0;flex:1">
            <div class="thread-company">${esc(p.productName)} ${p.sold ? `<span class="badge badge-ok">${p.sold} venta${p.sold === 1 ? '' : 's'}</span>` : ''}</div>
            <div class="thread-person">${p.quotes} cotización${p.quotes === 1 ? '' : 'es'} · ${p.accepted} aceptada${p.accepted === 1 ? '' : 's'}</div>
          </div>
          <b style="color:var(--ok)">${esc(money(p.revenue || 0, currency))}</b>
        </div>
      </a>`).join('')}
    </div>
  </section>` : ''}
`;
}

function bindVentas() { /* sin filtros adicionales */ }

function renderProductRoute(id) {
  const product = arr(S.state.products).find((p) => p.id === id);
  if (!product) {
    return emptyState({ iconName: 'box', title: 'Lámpara no encontrada', text: 'Volvió al catálogo para elegir otra.', actions: '<a class="btn btn-primary" href="#/productos">Ir al catálogo</a>' });
  }
  const missions = arr(S.state.missions).filter((m) => m.productId === id);
  const threads = arr(S.state.threads).filter((t) => t.productId === id);
  const content = arr(S.state.content).filter((c) => c.productId === id);
  const learnings = arr(S.state.learnings).filter((l) => String(l.scope || '').toLowerCase().includes(String(product.name || '').toLowerCase()));
  const sales = (S.state.sales?.byProduct || []).find((b) => b.productId === id) || { quotes: 0, accepted: 0, revenue: 0, sold: 0 };
  const currency = S.state.sales?.currency || product.currency || 'USD';
  const margin = product.price > 0 && product.cost > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : null;
  const draftsToReview = threads.reduce((acc, t) => acc + num(t.reviewCount), 0);
  const hot = threads.filter((t) => ['interesado','negociando'].includes(t.stage)).length;

  const missionBlocks = [...missions].sort((a,b) => new Date(b.createdAt||0)-new Date(a.createdAt||0)).map((m) => {
    const mThreads = threads.filter((t) => t.missionId === m.id);
    const mContent = content.filter((c) => c.missionId === m.id);
    return `<div class="route-mission">
      <div class="route-mission-head">
        <div>
          <div class="route-mission-title">${esc(m.name)} ${missionStatusBadge(m.status, m)}</div>
          <div class="route-mission-sub">${esc((m.markets||[]).join(' · ') || 'Mercado global')} · ${esc(DEPTHS[m.depth]?.label || m.depth)} · ${esc(relTime(m.finishedAt || m.createdAt))}</div>
        </div>
        <a class="btn btn-ghost btn-xs" href="#/misiones/${encodeURIComponent(m.id)}">Ver misión ${icon('arrowRight')}</a>
      </div>
      ${mThreads.length ? `<div class="route-buyers">
        <p class="tiny muted" style="margin-bottom:6px">${mThreads.length} comprador${mThreads.length===1?'':'es'} de esta misión</p>
        ${mThreads.map((t) => `<a class="route-buyer" href="#/bandeja/${encodeURIComponent(t.id)}">
          <span class="avatar sm">${esc(initials(t.contact?.company || '?'))}</span>
          <span style="min-width:0;flex:1">
            <b class="truncate" style="display:block;font-size:12.5px">${esc(t.contact?.company || 'Contacto')}</b>
            <span class="tiny muted">${esc(STAGES[t.stage]||t.stage)}${t.score?` · prioridad ${t.score}`:''}${t.awaitingReply?' · te escribió':''}</span>
          </span>
          ${t.demo ? '<span class="badge badge-demo">Ejemplo</span>' : t.awaitingReply ? '<span class="badge badge-ok">Real</span>' : ''}
          ${t.reviewCount ? `<span class="badge badge-warn">${t.reviewCount} por aprobar</span>` : ''}
          ${icon('chevronRight','icon-sm')}
        </a>`).join('')}
      </div>` : '<p class="tiny muted" style="margin-top:8px">Esta misión no creó conversaciones (sin compradores verificados).</p>'}
      ${mContent.length ? `<div class="route-content">
        <p class="tiny muted" style="margin:8px 0 6px">${mContent.length} pieza${mContent.length===1?'':'s'} de contenido</p>
        <div class="cluster">${mContent.map((c) => `<a class="badge badge-neutral" href="#/contenido" style="text-decoration:none">${esc(c.platform || 'Contenido')} · ${esc(CONTENT_STATUS[c.status]||c.status)}</a>`).join('')}</div>
      </div>` : ''}
    </div>`;
  }).join('');

  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Lámpara</p>
      <h2 class="page-title">${esc(product.name)}</h2>
      <p class="page-sub">${esc(product.code || 'sin código')} · ${esc(product.category || 'Lámpara')} · ${esc(money(product.price, product.currency))}${product.status ? ` · ${esc(product.status)}` : ''}.</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-ghost" type="button" data-action="edit-product" data-id="${attr(product.id)}">${icon('edit')} Editar</button>
      <a class="btn btn-primary" href="#/misiones/nueva?product=${encodeURIComponent(product.id)}">${icon('spark')} Lanzar misión</a>
    </div>
  </div>

  <div class="product-route-head">
    <div class="product-route-photo">${productImage(product)}</div>
    <div class="product-route-info">
      <div class="product-route-facts">
        ${product.materials ? `<span class="fact">${icon('factory')} ${esc(truncate(product.materials, 40))}</span>` : ''}
        ${product.weightGrams ? `<span class="fact">${icon('scale')} ${numFmt(product.weightGrams)} g</span>` : ''}
        ${margin !== null ? `<span class="fact">${icon('chart')} margen ${margin}%</span>` : ''}
        ${product.capacityPerWeek ? `<span class="fact">${icon('clock')} ${product.capacityPerWeek}/sem</span>` : ''}
        ${product.leadTimeDays ? `<span class="fact">${icon('truck')} ${product.leadTimeDays} días</span>` : ''}
        ${product.paymentLink ? `<a class="fact" href="${attr(safeUrl(product.paymentLink))}" target="_blank" rel="noopener noreferrer">${icon('dollar')} Link de pago</a>` : ''}
      </div>
      ${product.description ? `<p style="margin-top:10px;color:var(--ink-2);font-size:13.5px;line-height:1.6">${esc(product.description)}</p>` : ''}
      ${product.notes ? `<p class="tiny muted" style="margin-top:8px">${esc(product.notes)}</p>` : ''}
    </div>
  </div>

  <section class="stat-grid">
    ${statCard('Misiones', missions.length, 'spark', missions.length ? 'pasadas del equipo' : 'sin misiones aún', '', '')}
    ${statCard('Compradores', threads.length, 'users', threads.length ? `${hot} calientes` : 'ninguno aún', '', '')}
    ${statCard('Por aprobar', draftsToReview, 'mail', draftsToReview ? 'borradores pendientes' : 'nada pendiente', '', draftsToReview ? 'warm' : '')}
    ${statCard('Ventas', sales.sold || 0, 'dollar', sales.revenue ? `${money(sales.revenue, currency)} cobros manuales` : 'todavía ninguna', '#/ventas', sales.sold ? 'warm' : '')}
    ${statCard('Contenido', content.length, 'image', content.filter((c)=>c.status==='publicado').length ? `${content.filter((c)=>c.status==='publicado').length} publicado${content.filter((c)=>c.status==='publicado').length===1?'':'s'}` : 'ideas y borradores', '', '')}
  </section>

  <section class="section">
    <div class="section-head">
      <div><h2 class="section-title">El recorrido</h2><p class="section-sub">De la ficha a la venta: cada misión, sus compradores y lo que se publicó.</p></div>
      ${missions.length ? '' : `<a class="btn btn-primary btn-sm" href="#/misiones/nueva?product=${encodeURIComponent(product.id)}">Lanzar la primera misión</a>`}
    </div>
    ${missions.length ? `<div class="route-timeline">${missionBlocks}</div>` : emptyState({ iconName:'spark', title:'Todavía no hay misiones', text:'Lanzá una misión para que el equipo investigue, busque compradores y deje los borradores.', actions:`<a class="btn btn-primary" href="#/misiones/nueva?product=${encodeURIComponent(product.id)}">${icon('spark')} Lanzar la primera</a>` })}
  </section>

  ${content.length ? `<section class="section">
    <div class="section-head">
      <div><h2 class="section-title">Contenido del producto</h2><p class="section-sub">Lo que la IA preparó y dónde se publicó.</p></div>
      <a class="section-link" href="#/contenido">Ver todo ${icon('arrowRight')}</a>
    </div>
    <div class="content-list">${content.map(contentCardHTML).join('')}</div>
  </section>` : ''}

  ${learnings.length ? `<section class="section">
    <div class="section-head">
      <div><h2 class="section-title">Aprendizajes</h2><p class="section-sub">Lo que el equipo aprendió sobre esta lámpara.</p></div>
    </div>
    <div class="learning-list">${learnings.map(learningCardHTML).join('')}</div>
  </section>` : ''}
`;
}

function bindProductRoute(id) { /* sin filtros adicionales */ }

function renderProducts() {
  const products = arr(S.state.products);
  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Catálogo</p>
      <h2 class="page-title">Tus lámparas, con todo lo que el equipo necesita.</h2>
      <p class="page-sub">Foto, precio, código y notas. Cuanto mejor el punto de partida, mejor el plan que devuelve el equipo.</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-ghost" type="button" data-action="import-products">${icon('upload')} Importar CSV</button>
      <button class="btn btn-ghost" type="button" data-action="campaign-catalog" ${products.length ? '' : 'disabled'}>${icon('spark')} Campaña de catálogo</button>
      <button class="btn btn-accent" type="button" data-action="quote-catalog" ${products.length ? '' : 'disabled'}>${icon('dollar')} Cotizar todo el catálogo</button>
      ${S.ui.selectedProducts.length ? `<button class="btn btn-accent" type="button" data-action="campaign-selected">${icon('spark')} Poner a la venta (${S.ui.selectedProducts.length})</button>` : ''}
      <button class="btn btn-primary" type="button" data-action="new-product">${icon('plus')} Nueva lámpara</button>
    </div>
    <input type="file" id="product-import-input" accept=".csv,text/csv" hidden>
  </div>

  ${products.length ? `
  <div class="filterbar">
    <div class="search-field">${icon('search')}<input class="input" id="product-search" type="search" placeholder="Buscar por nombre, código o material”¦" value="${attr(S.ui.productQuery)}"></div>
    <select class="select" id="product-status-filter" style="max-width:180px">
      ${[['todos', 'Todos los estados'], ['listo', 'Listos'], ['borrador', 'Borradores'], ['archivado', 'Archivados']].map(([v, l]) => `<option value="${v}" ${S.ui.productStatus === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <span class="small muted" id="product-count">${products.length} ${products.length === 1 ? 'producto' : 'productos'}</span>
  </div>
  <div class="product-grid" id="product-grid">${productGridHTML()}</div>` : emptyState({
    iconName: 'box',
    title: 'Todavía no hay lámparas',
    text: 'Cargá tu primera pieza con una foto, un precio y dos o tres notas. El equipo se encarga de convertir eso en un plan comercial.',
    actions: `<button class="btn btn-primary" type="button" data-action="new-product">${icon('plus')} Cargar mi primera lámpara</button><button class="btn btn-ghost" type="button" data-action="demo-seed">${icon('sun')} Ver con datos de ejemplo</button>`,
  })}`;
}

function filteredProducts() {
  const q = S.ui.productQuery.trim().toLowerCase();
  return arr(S.state.products).filter((p) => {
    if (S.ui.productStatus !== 'todos' && p.status !== S.ui.productStatus) return false;
    if (!q) return true;
    return [p.name, p.code, p.category, p.materials, p.description, p.notes].some((v) => String(v || '').toLowerCase().includes(q));
  });
}

function productGridHTML() {
  const products = filteredProducts();
  if (!products.length) return `<div class="card card-pad" style="grid-column:1/-1;text-align:center;color:var(--muted)">No hay productos que coincidan con el filtro.</div>`;
  return products.map(productCard).join('');
}

function productCard(product) {
  const margin = product.price > 0 && product.cost > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : null;
  return `<article class="product-card ${S.ui.selectedProducts.includes(product.id) ? 'selected' : ''}">
    <div class="product-photo">
      <label class="product-select" title="Seleccionar para poner a la venta">
        <input type="checkbox" data-action="toggle-product-select" data-id="${attr(product.id)}" ${S.ui.selectedProducts.includes(product.id) ? 'checked' : ''}>
      </label>
      ${productImage(product)}
      <div class="product-badges">${demoBadge(product.demo)}<span class="badge ${product.status === 'listo' ? 'badge-ok' : product.status === 'archivado' ? 'badge-neutral' : 'badge-warn'}">${esc(product.status || 'borrador')}</span></div>
      <span class="product-price-tag">${esc(money(product.price, product.currency))}</span>
    </div>
    <div class="product-body">
      <h3 class="product-name"><a href="#/productos/${encodeURIComponent(product.id)}" style="color:inherit;text-decoration:none">${esc(product.name)}</a></h3>
      <p class="product-code">${esc(product.code || 'sin código')} · ${esc(product.category || 'Lámpara')}</p>
      ${product.description ? `<p class="product-desc">${esc(product.description)}</p>` : `<p class="product-desc muted">Sin descripción. Agregá medidas o materiales para que el equipo escriba mejor.</p>`}
      <div class="product-meta">
        ${product.materials ? `<span>${icon('factory')} ${esc(truncate(product.materials, 34))}</span>` : ''}
        ${product.weightGrams ? `<span>${icon('scale')} ${numFmt(product.weightGrams)} g</span>` : ''}
        ${margin !== null ? `<span>${icon('chart')} margen ${margin}%</span>` : ''}
      </div>
      <div class="product-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-action="edit-product" data-id="${attr(product.id)}">${icon('edit')} Editar</button>
        <a class="btn btn-primary btn-sm" href="#/misiones/nueva?product=${encodeURIComponent(product.id)}">${icon('spark')} Misión</a>
      </div>
    </div>
  </article>`;
}

function bindProducts() {
  const search = $('#product-search');
  if (search) {
    search.addEventListener('input', () => {
      S.ui.productQuery = search.value;
      $('#product-grid').innerHTML = productGridHTML();
      const count = $('#product-count');
      if (count) count.textContent = `${filteredProducts().length} ${filteredProducts().length === 1 ? 'producto' : 'productos'}`;
    });
  }
  const filter = $('#product-status-filter');
  if (filter) {
    filter.addEventListener('change', () => {
      S.ui.productStatus = filter.value;
      $('#product-grid').innerHTML = productGridHTML();
      const count = $('#product-count');
      if (count) count.textContent = `${filteredProducts().length} ${filteredProducts().length === 1 ? 'producto' : 'productos'}`;
    });
  }
  const importInput = $('#product-import-input');
  if (importInput) {
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const result = await api('/api/products/import', {
          method: 'POST',
          headers: { 'content-type': 'text/csv' },
          body: text,
        });
        const extras = (result.skipped?.length || 0) + (result.errors?.length || 0);
        toast(`Importados ${result.created} producto${result.created === 1 ? '' : 's'}${extras ? ` · ${extras} fila${extras === 1 ? '' : 's'} omitida${extras === 1 ? '' : 's'}` : ''}.`);
        await loadState();
      } catch (error) {
        toast(error.message || 'No se pudo importar el CSV.', 'error');
      } finally {
        importInput.value = '';
      }
    });
  }
}

function openCampaignModal(productIds = null) {
  const selected = productIds || S.ui.selectedProducts || [];
  const products = arr(S.state.products).filter((product) => product.status !== 'archivado' && (selected.length ? selected.includes(product.id) : true));
  if (!products.length) {
    toast('Cargá al menos un producto activo antes de lanzar una campaña.', 'error');
    return;
  }
  const settings = S.state.settings || {};
  const markets = arr(settings.mission?.markets).filter(Boolean);
  const depth = settings.mission?.depth || 'rapida';
  openModal({
    title: 'Campaña de catálogo',
    subtitle: `${products.length} producto${products.length === 1 ? '' : 's'} · una misión por producto, en cola`,
    body: `<form id="campaign-form" autocomplete="off">
      <input type="hidden" name="productIds" value="${attr((productIds || S.ui.selectedProducts || []).join(','))}">
      <div class="form-grid">
        <div class="field full"><label for="campaign-strategy">Cómo repartir los mercados</label>
          <select class="select" id="campaign-strategy" name="strategy">
            <option value="rotate">Rotar: cada producto va a un mercado distinto (recomendado)</option>
            <option value="all">Todos los mercados para cada producto</option>
          </select>
          <p class="field-hint">Rotar evita golpear la misma lista de compradores con todo el catálogo el mismo día y estira la cuota de búsqueda.</p>
        </div>
        <div class="field full"><label for="campaign-markets">Mercados</label><input class="input" id="campaign-markets" name="markets" value="${attr(markets.join(', '))}" placeholder="España, México, Estados Unidos"><p class="field-hint">Separados por coma. Se usan los de Ajustes → Misión si lo dejás vacío.</p></div>
        <div class="field"><label for="campaign-depth">Profundidad</label><select class="select" id="campaign-depth" name="depth">
          ${[['rapida', 'Rápida'], ['estandar', 'Estándar'], ['profunda', 'Profunda']].map(([value, label]) => `<option value="${value}" ${depth === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select></div>
        <div class="field"><label for="campaign-name">Nombre</label><input class="input" id="campaign-name" name="name" placeholder="Catálogo de temporada"></div>
      </div>
      <div class="artifact-callout mt-3"><b>Qué va a pasar</b>Lucian crea una misión por producto. Las misiones esperan en cola de a dos, buscan compradores, verifican y dejan los borradores en la bandeja. Nada se envía sin tu aprobación (salvo que actives el piloto automático).</div>
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" type="button" data-action="launch-campaign">${icon('spark')} Lanzar campaña</button>`,
  });
}

async function launchCampaign() {
  const form = $('#campaign-form');
  if (!form) return;
  const fd = new FormData(form);
  const markets = String(fd.get('markets') || '').split(/[,;\n]+/).map((market) => market.trim()).filter(Boolean);
  try {
    const productIds = String(fd.get('productIds') || '').split(',').map((id) => id.trim()).filter(Boolean);
    const result = await api('/api/campaigns', {
      method: 'POST',
      body: {
        productIds,
        marketStrategy: String(fd.get('strategy') || 'rotate'),
        markets,
        depth: String(fd.get('depth') || ''),
        name: String(fd.get('name') || '').trim(),
      },
    });
    closeModal(true);
    S.ui.selectedProducts = [];
    const created = result.campaign?.created?.length || 0;
    const skipped = result.campaign?.skipped?.length || 0;
    toast(`Campaña creada: ${created} misión${created === 1 ? '' : 'es'} en cola${skipped ? ` · ${skipped} producto${skipped === 1 ? '' : 's'} omitido${skipped === 1 ? '' : 's'}` : ''}.`);
    await loadState();
    navigate('#/misiones');
  } catch (error) {
    toast(error.message || 'No se pudo lanzar la campaña.', 'error');
  }
}

function openProductModal(id = null) {
  const product = id ? S.state.products.find((p) => p.id === id) : null;
  S.ui.productEditId = product?.id || null;
  S.ui.productPhotos = product
    ? arr(product.photos).map((p) => ({ file: p.file, alt: p.alt || product.name, preview: mediaUrl(p.file) }))
    : [];
  const b = S.state.brand || {};
  const settings = S.state.settings || {};
  const body = `<form id="product-form" autocomplete="off">
    <div class="form-section">
      <p class="form-section-title">Fotos</p>
      <p class="form-section-sub">Hasta 6 imágenes. La primera es la portada. Se comprimen en tu navegador antes de guardar.</p>
      <div class="photo-upload">
        <label class="photo-drop" id="photo-drop" for="photo-input">
          ${icon('image')}
          <b>Arrastrá fotos o hacé clic para elegir</b>
          <span>JPG, PNG o WEBP · máximo 8 MB por archivo</span>
          <input class="file-input" id="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple>
        </label>
        <div class="photo-thumbs" id="photo-thumbs">${photoThumbsHTML()}</div>
        <p class="photo-count" id="photo-count">${S.ui.productPhotos.length} de 6 fotos</p>
      </div>
    </div>
    <div class="form-section">
      <p class="form-section-title">La pieza</p>
      <p class="form-section-sub">Datos que el equipo usa para investigar, cotizar y escribir.</p>
      <div class="form-grid">
        <div class="field full"><label for="pf-name">Nombre <span class="req">*</span></label><input class="input" id="pf-name" name="name" required value="${attr(product?.name || '')}" placeholder="Ej.: Aurora 01"></div>
        <div class="field"><label for="pf-code">Código / SKU</label><input class="input" id="pf-code" name="code" value="${attr(product?.code || '')}" placeholder="AUR-01"></div>
        <div class="field"><label for="pf-category">Categoría</label><input class="input" id="pf-category" name="category" value="${attr(product?.category || 'Lámpara')}" placeholder="Colgante, de mesa, aplique”¦"></div>
        <div class="field"><label for="pf-price">Precio de venta</label><input class="input" id="pf-price" name="price" type="number" min="0" step="0.01" value="${attr(product?.price ?? '')}" placeholder="240"></div>
        <div class="field"><label for="pf-currency">Moneda</label><select class="select" id="pf-currency" name="currency">${CURRENCIES.map((c) => `<option value="${c}" ${(product?.currency || settings.mission?.currency || b.currency || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label for="pf-cost">Costo de producción</label><input class="input" id="pf-cost" name="cost" type="number" min="0" step="0.01" value="${attr(product?.cost ?? '')}" placeholder="80"><p class="field-hint">Materiales, impresión, terminación y packaging.</p></div>
        <div class="field"><label for="pf-weight">Peso (gramos)</label><input class="input" id="pf-weight" name="weightGrams" type="number" min="0" step="1" value="${attr(product?.weightGrams ?? '')}" placeholder="1200"></div>
        <div class="field"><label for="pf-dimensions">Medidas</label><input class="input" id="pf-dimensions" name="dimensions" value="${attr(product?.dimensions || '')}" placeholder="Ø 32 cm · alto 24 cm · cable 180 cm"></div>
        <div class="field"><label for="pf-capacity">Capacidad semanal</label><input class="input" id="pf-capacity" name="capacityPerWeek" type="number" min="0" step="1" value="${attr(product?.capacityPerWeek ?? '')}" placeholder="8"><p class="field-hint">Unidades que podés fabricar por semana sin romper plazos.</p></div>
        <div class="field"><label for="pf-leadtime">Plazo de fabricación (días)</label><input class="input" id="pf-leadtime" name="leadTimeDays" type="number" min="0" step="1" value="${attr(product?.leadTimeDays ?? '')}" placeholder="14"><p class="field-hint">Desde la confirmación del pago hasta el despacho.</p></div>
        <div class="field full"><label for="pf-payment">Link de pago o seña</label><input class="input" id="pf-payment" name="paymentLink" type="url" value="${attr(product?.paymentLink || '')}" placeholder="https://link.mercadopago.com.ar/”¦ o https://buy.stripe.com/”¦"><p class="field-hint">Se incluye en las cotizaciones para cerrar sin idas y vueltas.</p></div>
        <div class="field"><label for="pf-status">Estado</label><select class="select" id="pf-status" name="status">${[['borrador', 'Borrador'], ['listo', 'Listo para vender'], ['archivado', 'Archivado']].map(([v, l]) => `<option value="${v}" ${(product?.status || 'borrador') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field full"><label for="pf-materials">Materiales y terminación</label><input class="input" id="pf-materials" name="materials" value="${attr(product?.materials || '')}" placeholder="PLA / PETG, difusor opal, cable textil, casquillo E27"></div>
        <div class="field full"><label for="pf-description">Descripción corta</label><textarea class="textarea" id="pf-description" name="description" rows="3" placeholder="Qué la hace distinta, en dos o tres líneas.">${esc(product?.description || '')}</textarea></div>
        <div class="field full"><label for="pf-notes">Notas para el equipo</label><textarea class="textarea" id="pf-notes" name="notes" rows="3" placeholder="Capacidad de producción, colores, plazos, certificaciones pendientes, precio mínimo”¦">${esc(product?.notes || '')}</textarea><p class="field-hint">Todo lo que un vendedor nuevo necesitaría saber antes de hablar con un comprador.</p></div>
      </div>
    </div>
  </form>`;
  const footer = `${product ? `<button class="btn btn-danger btn-sm left" type="button" data-action="delete-product" data-id="${attr(product.id)}">${icon('trash')} Eliminar</button>` : ''}
    <button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button>
    <button class="btn btn-primary" type="button" data-action="save-product">${icon('check')} ${product ? 'Guardar cambios' : 'Crear producto'}</button>`;
  openModal({
    title: product ? 'Editar lámpara' : 'Nueva lámpara',
    subtitle: product ? product.code || product.name : 'Con una foto y un precio ya se puede trabajar.',
    size: 'modal-lg',
    body,
    footer,
    onMount: (root) => bindPhotoUploader(root),
  });
}

function photoThumbsHTML() {
  return S.ui.productPhotos.map((p, index) => `<div class="photo-thumb">
    <img src="${attr(p.preview)}" alt="${attr(p.alt || 'Foto')}">
    <button class="photo-remove" type="button" data-action="remove-photo" data-index="${index}" aria-label="Quitar foto">${icon('x')}</button>
    <span class="photo-alt">${index === 0 ? 'Portada' : esc(p.alt || '')}</span>
  </div>`).join('');
}

function bindPhotoUploader(root) {
  const input = $('#photo-input', root);
  const drop = $('#photo-drop', root);
  if (!input) return;
  input.addEventListener('change', async () => {
    await addProductPhotos([...input.files]);
    input.value = '';
  });
  if (drop) {
    ['dragenter', 'dragover'].forEach((evt) => drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((evt) => drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', async (e) => {
      const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith('image/'));
      await addProductPhotos(files);
    });
  }
}

async function addProductPhotos(files) {
  if (!files.length) return;
  const remaining = 6 - S.ui.productPhotos.length;
  if (remaining <= 0) { toast('Máximo 6 fotos por producto.', 'info'); return; }
  const selected = files.slice(0, remaining);
  for (const file of selected) {
    if (file.size > 8 * 1024 * 1024) { toast(`${file.name}: supera los 8 MB.`, 'error'); continue; }
    try {
      const dataUrl = await compressImage(file);
      S.ui.productPhotos.push({ dataUrl, preview: dataUrl, alt: file.name.replace(/\.[^.]+$/, '') });
    } catch (error) {
      toast(`No pude leer ${file.name}: ${error.message}`, 'error');
    }
  }
  const thumbs = $('#photo-thumbs');
  if (thumbs) thumbs.innerHTML = photoThumbsHTML();
  const count = $('#photo-count');
  if (count) count.textContent = `${S.ui.productPhotos.length} de 6 fotos`;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('archivo ilegible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('formato no soportado'));
      img.onload = () => {
        const max = 1600;
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fffaf1';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function saveProduct() {
  const form = $('#product-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!String(data.name || '').trim()) { toast('La lámpara necesita un nombre.', 'error'); $('#pf-name')?.focus(); return; }
  const payload = {
    name: data.name,
    code: data.code,
    category: data.category,
    price: num(data.price, 0),
    currency: data.currency,
    cost: num(data.cost, 0),
    weightGrams: num(data.weightGrams, 0),
    dimensions: data.dimensions,
    capacityPerWeek: num(data.capacityPerWeek, 0),
    leadTimeDays: num(data.leadTimeDays, 0),
    paymentLink: data.paymentLink,
    materials: data.materials,
    description: data.description,
    notes: data.notes,
    status: data.status,
    photos: S.ui.productPhotos.map((p) => p.dataUrl ? { dataUrl: p.dataUrl, alt: p.alt || data.name } : { file: p.file, alt: p.alt || data.name }),
  };
  try {
    if (S.ui.productEditId) await api(`/api/products/${encodeURIComponent(S.ui.productEditId)}`, { method: 'PUT', body: payload });
    else await api('/api/products', { method: 'POST', body: payload });
    closeModal();
    await loadState();
    toast(S.ui.productEditId ? 'Producto actualizado.' : 'Producto creado. Ya puede entrar en una misión.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   10. Listado de misiones
   ───────────────────────────────────────────────────────────── */

function renderMissions() {
  const missions = [...arr(S.state.missions)].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const active = missions.filter((m) => ['running', 'queued'].includes(m.status));
  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Sala de misión</p>
      <h2 class="page-title">Un objetivo por misión. Sin dispersarse.</h2>
      <p class="page-sub">Cada pasada del equipo investiga, calcula, escribe y se contradice antes de darte un plan. Podés seguirla en vivo o leer el resultado cuando termine.</p>
    </div>
    <div class="page-actions">
      ${arr(S.state.products).length ? `<button class="btn btn-ghost" type="button" data-action="campaign-catalog">${icon('spark')} Campaña de catálogo</button>` : ''}
      ${missions.length ? `<button class="btn btn-danger" type="button" data-action="delete-all-missions">${icon('trash')} Borrar todas (${missions.length})</button>` : ''}
      <button class="btn btn-primary" type="button" data-action="new-mission">${icon('plus')} Nueva misión</button>
    </div>
  </div>

  ${active.length ? `<div class="card card-pad" style="margin-bottom:18px;background:linear-gradient(100deg,#fff7e8,#fffaf1)">
    <div class="between"><div><p class="eyebrow">En curso</p><p style="font-family:var(--serif);font-size:21px;margin-top:3px">${esc(active[0].name)}</p></div><a class="btn btn-primary btn-sm" href="#/misiones/${encodeURIComponent(active[0].id)}">Entrar a la sala ${icon('arrowRight')}</a></div>
    <div class="progress mt-3"><div class="progress-bar" style="width:${Math.max(3, num(active[0].progress))}%"></div></div>
    <div class="progress-label"><span>${esc(MISSION_STATUS[active[0].status] || active[0].status)}</span><b>${active[0].progress || 0}%</b></div>
  </div>` : ''}

  ${missions.length
    ? `<div class="mission-list">${missions.map(missionCard).join('')}</div>`
    : emptyState({
      iconName: 'spark',
      title: 'La primera misión empieza con una lámpara',
      text: 'Cargá un producto y elegí qué querés conseguir. El equipo se encarga del mercado, los precios, los compradores y los mensajes.',
      actions: arr(S.state.products).length
        ? `<a class="btn btn-primary" href="#/misiones/nueva">${icon('spark')} Lanzar una misión</a>`
        : `<button class="btn btn-primary" type="button" data-action="new-product">${icon('plus')} Cargar una lámpara</button>`,
    })}`;
}

/* ─────────────────────────────────────────────────────────────
   11. Asistente de nueva misión
   ───────────────────────────────────────────────────────────── */

function ensureWizard() {
  const products = arr(S.state?.products);
  if (S.wizard && products.some((p) => p.id === S.wizard.productId)) return S.wizard;
  const settings = S.state?.settings || {};
  const queryProduct = S.route.query?.get('product');
  const productId = products.some((p) => p.id === queryProduct) ? queryProduct : products[0]?.id || null;
  S.wizard = {
    step: 1,
    productId,
    goal: 'conseguir-mayoristas',
    markets: [...arr(settings.mission?.markets)].slice(0, 4),
    depth: settings.mission?.depth || 'estandar',
    tone: settings.mission?.tone || TONES[0],
    notes: '',
    maxProspects: num(settings.mission?.maxProspects, 12),
    budget: 0,
    mode: 'auto',
  };
  return S.wizard;
}

function renderWizard() {
  const w = ensureWizard();
  const products = arr(S.state.products);
  if (!products.length) {
    return `${pageHeaderWizard()}
      ${emptyState({
        iconName: 'box',
        title: 'Primero, una lámpara',
        text: 'Para lanzar una misión necesitás al menos un producto con nombre y precio. Podés crearlo en un minuto.',
        actions: `<button class="btn btn-primary" type="button" data-action="new-product">${icon('plus')} Cargar lámpara</button><button class="btn btn-ghost" type="button" data-action="demo-seed">${icon('sun')} Usar datos de ejemplo</button>`,
      })}`;
  }
  const product = products.find((p) => p.id === w.productId) || products[0];
  const modeLabel = w.mode === 'demo' ? 'Demo' : w.mode === 'real' ? 'Real' : S.state.flags?.ai ? 'Real (IA configurada)' : 'Demo (sin IA)';
  const stepNames = ['Producto', 'Objetivo', 'Mercados', 'Modo'];
  const stepsBar = `<div class="wizard-steps">${stepNames.map((name, index) => {
    const n = index + 1;
    return `<div class="wizard-step ${w.step === n ? 'active' : w.step > n ? 'done' : ''}"><span class="num">${w.step > n ? '✓' : n}</span><span>${name}</span></div>${index < stepNames.length - 1 ? '<span class="wizard-step-line"></span>' : ''}`;
  }).join('')}</div>`;

  let stepBody = '';
  if (w.step === 1) {
    stepBody = `<h3 class="wizard-title">¿Qué lámpara va a salir a vender?</h3>
      <p class="wizard-sub">Elegí una pieza. El equipo va a leer sus fotos, precio y notas.</p>
      <div class="choice-grid">${products.map((p) => `
        <button class="choice ${w.productId === p.id ? 'selected' : ''}" type="button" data-action="wizard-product" data-id="${attr(p.id)}">
          <div style="display:flex;gap:11px;align-items:center">
            ${productThumb(p)}
            <div style="min-width:0"><div class="choice-title">${esc(p.name)}</div><div class="choice-sub">${esc(p.code || 'sin código')} · ${esc(money(p.price, p.currency))}</div></div>
          </div>
          ${p.description ? `<p class="choice-sub" style="margin-top:9px">${esc(truncate(p.description, 110))}</p>` : ''}
          ${p.demo ? '<span class="badge badge-demo" style="margin-top:9px">Ejemplo</span>' : ''}
        </button>`).join('')}</div>
      <div class="mt-3"><button class="btn btn-ghost btn-sm" type="button" data-action="new-product">${icon('plus')} Cargar otra lámpara</button></div>`;
  } else if (w.step === 2) {
    stepBody = `<h3 class="wizard-title">¿Qué querés conseguir?</h3>
      <p class="wizard-sub">Un objetivo claro hace que el plan sea usable. No hace falta pedir todo.</p>
      <div class="choice-grid">${GOALS.map((g) => `
        <button class="choice ${w.goal === g.id ? 'selected' : ''}" type="button" data-action="wizard-goal" data-id="${attr(g.id)}">
          <div class="choice-title">${esc(g.title)}</div>
          <div class="choice-sub">${esc(g.sub)}</div>
        </button>`).join('')}</div>`;
  } else if (w.step === 3) {
    stepBody = `<h3 class="wizard-title">¿En qué mercados querés probar?</h3>
      <p class="wizard-sub">Para una persona sola, dos o tres mercados ya es ambicioso. El red team puede recortar.</p>
      <div class="market-chips">${MARKET_OPTIONS.map((m) => `<button class="chip ${w.markets.includes(m) ? 'active' : ''}" type="button" data-action="wizard-market" data-market="${attr(m)}">${w.markets.includes(m) ? icon('check') : ''}${esc(m)}</button>`).join('')}</div>
      <div class="field mt-4" style="max-width:420px"><label for="wiz-custom-market">Agregar otro país</label><div class="field-row"><input class="input" id="wiz-custom-market" placeholder="Ej.: Suiza"><button class="btn btn-ghost btn-sm" type="button" data-action="wizard-add-market">Agregar</button></div></div>
      ${w.markets.length ? `<div class="soft mt-3"><p class="tiny muted" style="margin-bottom:5px">Seleccionados</p><div class="cluster">${w.markets.map((m) => `<span class="badge badge-amber">${esc(m)} <button type="button" data-action="wizard-remove-market" data-market="${attr(m)}" style="border:0;background:none;padding:0;color:inherit;display:inline-flex">${icon('x', 'icon-sm')}</button></span>`).join('')}</div></div>` : '<p class="field-hint mt-3">Elegí al menos un mercado.</p>'}`;
  } else {
    const aiReady = Boolean(S.state.flags?.ai);
    stepBody = `<h3 class="wizard-title">Profundidad y modo de trabajo</h3>
      <p class="wizard-sub">Más profundidad significa más llamadas a la IA y más tiempo. No siempre vale la pena.</p>
      <div class="depth-grid">${Object.entries(DEPTHS).map(([id, d]) => `
        <button class="depth-card ${w.depth === id ? 'selected' : ''}" type="button" data-action="wizard-depth" data-id="${id}">
          <b>${esc(d.label)}</b><p>${esc(d.description)}</p>
          <div class="depth-meta"><span>${icon('spark')} ${d.steps} pasos</span><span>${icon('clock')} ${esc(d.minutes)} min</span><span>${d.calls} llamadas</span></div>
        </button>`).join('')}</div>

      <div class="form-section mt-4">
        <p class="form-section-title">Modo</p>
        <p class="form-section-sub">${aiReady ? 'La IA está configurada.' : 'Todavía no hay una IA configurada, así que el modo real no está disponible.'}</p>
        <div class="choice-grid">
          <button class="choice ${w.mode === 'auto' ? 'selected' : ''}" type="button" data-action="wizard-mode" data-id="auto"><div class="choice-title">Automático</div><div class="choice-sub">${aiReady ? 'Usa la IA configurada y datos reales.' : 'Como no hay IA, corre en demo para que puedas ver el flujo.'}</div></button>
          <button class="choice ${w.mode === 'demo' ? 'selected' : ''}" type="button" data-action="wizard-mode" data-id="demo"><div class="choice-title">Demo</div><div class="choice-sub">Datos simulados y marcados como ejemplo. Ideal para aprender el sistema.</div></button>
          <button class="choice ${w.mode === 'real' ? 'selected' : ''} ${!aiReady ? 'disabled' : ''}" type="button" data-action="wizard-mode" data-id="real" ${!aiReady ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}><div class="choice-title">Real</div><div class="choice-sub">${aiReady ? 'Investigación y redacción con IA sobre datos reales.' : 'Configurá una IA en Ajustes para habilitarlo.'}</div></button>
        </div>
      </div>

      <div class="form-section">
        <p class="form-section-title">Ajustes finos</p>
        <div class="form-grid">
          <div class="field full"><label for="wiz-tone">Tono de los mensajes</label><input class="input" id="wiz-tone" value="${attr(w.tone)}" placeholder="cercano, experto, sin presión" list="tone-list"><datalist id="tone-list">${TONES.map((t) => `<option value="${attr(t)}">`).join('')}</datalist></div>
          <div class="field"><label for="wiz-max">Compradores a buscar</label><input class="input" id="wiz-max" type="number" min="1" max="40" value="${attr(w.maxProspects)}"></div>
          <div class="field"><label for="wiz-budget">Presupuesto de prueba</label><input class="input" id="wiz-budget" type="number" min="0" step="1" value="${attr(w.budget)}" placeholder="0"><p class="field-hint">Solo para muestras, envíos o fichas. No es obligatorio.</p></div>
          <div class="field full"><label for="wiz-notes">Contexto para el equipo</label><textarea class="textarea" id="wiz-notes" rows="4" placeholder="Ej.: puedo producir 4 unidades por semana, no quiero bajar de 150 USD mayorista, tengo pendiente la certificación UL.">${esc(w.notes)}</textarea></div>
        </div>
      </div>`;
  }

  return `${pageHeaderWizard()}
  <div class="wizard">
    <div class="wizard-main card card-pad">
      ${stepsBar}
      ${stepBody}
      <div class="wizard-foot">
        <button class="btn btn-ghost" type="button" data-action="wizard-prev" ${w.step === 1 ? 'style="visibility:hidden"' : ''}>${icon('arrowLeft')} Atrás</button>
        ${w.step < 4
          ? `<button class="btn btn-primary" type="button" data-action="wizard-next">Siguiente ${icon('arrowRight')}</button>`
          : `<button class="btn btn-accent" type="button" data-action="wizard-launch">${icon('spark')} Lanzar misión</button>`}
      </div>
    </div>
    <aside class="summary-card card">
      <p class="eyebrow">Resumen</p>
      <h3>${esc(product.name)}</h3>
      <p class="small muted">${esc(product.code || 'sin código')} · ${esc(money(product.price, product.currency))}</p>
      <div class="mt-3">
        <div class="summary-row"><span>Objetivo</span><b>${esc(GOALS.find((g) => g.id === w.goal)?.title || w.goal)}</b></div>
        <div class="summary-row"><span>Mercados</span><b>${esc(w.markets.join(', ') || 'sin elegir')}</b></div>
        <div class="summary-row"><span>Profundidad</span><b>${esc(DEPTHS[w.depth]?.label || w.depth)}</b></div>
        <div class="summary-row"><span>Pasos</span><b>${DEPTHS[w.depth]?.steps || '””'}</b></div>
        <div class="summary-row"><span>Tiempo estimado</span><b>${esc(DEPTHS[w.depth]?.minutes || '””')} min</b></div>
        <div class="summary-row"><span>Modo</span><b>${esc(modeLabel)}</b></div>
      </div>
      ${!S.state.flags?.ai ? '<div class="summary-note warn">Sin IA configurada, esta misión se ejecuta en demo. Sirve para recorrer todo el flujo con datos de ejemplo.</div>' : ''}
      ${w.mode === 'demo' ? '<div class="summary-note">Los datos generados quedan marcados como ejemplo y no se envían a nadie real.</div>' : ''}
      <div class="summary-note">No se envía nada automáticamente. Todo queda como borrador para que lo revises.</div>
    </aside>
  </div>`;
}

function pageHeaderWizard() {
  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Nueva misión</p>
      <h2 class="page-title">Decile al equipo qué querés conseguir.</h2>
      <p class="page-sub">Cuatro decisiones y el equipo se pone a trabajar. Nada se envía sin tu revisión.</p>
    </div>
    <div class="page-actions"><a class="btn btn-ghost" href="#/misiones">${icon('arrowLeft')} Volver a misiones</a></div>
  </div>`;
}

function syncWizardFields() {
  if (!S.wizard) return;
  const tone = $('#wiz-tone');
  const notes = $('#wiz-notes');
  const max = $('#wiz-max');
  const budget = $('#wiz-budget');
  if (tone) S.wizard.tone = tone.value;
  if (notes) S.wizard.notes = notes.value;
  if (max) S.wizard.maxProspects = num(max.value, 12);
  if (budget) S.wizard.budget = num(budget.value, 0);
}

function bindWizard() {
  ['wiz-tone', 'wiz-notes', 'wiz-max', 'wiz-budget'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', syncWizardFields);
  });
  const custom = $('#wiz-custom-market');
  if (custom) custom.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); addCustomMarket(); }
  });
}

function addCustomMarket() {
  const input = $('#wiz-custom-market');
  const value = String(input?.value || '').trim();
  if (!value) return;
  if (!S.wizard.markets.includes(value)) S.wizard.markets.push(value);
  render();
}

async function launchWizard() {
  syncWizardFields();
  const w = S.wizard;
  if (!w.productId) { toast('Elegí un producto.', 'error'); return; }
  if (!w.markets.length) { toast('Elegí al menos un mercado.', 'error'); w.step = 3; render(); return; }
  const button = $('[data-action="wizard-launch"]');
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Preparando”¦`; }
  try {
    const result = await api('/api/missions', {
      method: 'POST',
      body: {
        productId: w.productId,
        goal: w.goal,
        markets: w.markets,
        depth: w.depth,
        tone: w.tone,
        notes: w.notes,
        maxProspects: w.maxProspects,
        budget: w.budget,
        mode: w.mode,
      },
    });
    const missionId = result.mission.id;
    S.wizard = null;
    S.mission = null;
    navigate(`#/misiones/${encodeURIComponent(missionId)}`);
    toast(result.mission.demo ? 'Misión demo lanzada. El equipo está simulando el trabajo.' : 'Misión lanzada. El equipo está trabajando.');
    setTimeout(() => { S.mission = null; render(); }, 300);
  } catch (error) {
    toast(error.message, 'error');
    if (button) { button.disabled = false; button.innerHTML = `${icon('spark')} Lanzar misión`; }
  }
}

/* ─────────────────────────────────────────────────────────────
   12. Sala de misión
   ───────────────────────────────────────────────────────────── */

async function loadMission(id) {
  if (S.missionLoading === id) return;
  S.missionLoading = id;
  try {
    const data = await api(`/api/missions/${encodeURIComponent(id)}`, { silent: true });
    S.mission = data;
    if (S.ui.missionId !== id) {
      S.ui.missionId = id;
      S.ui.openSteps = new Set();
      if (['done', 'done_with_warnings'].includes(data.mission.status)) S.ui.openSteps.add('synthesis');
      else {
        const running = arr(data.mission.steps).find((s) => s.status === 'running');
        S.ui.openSteps.add(running?.id || 'brief');
      }
    }
    if (S.route.view === 'misiones' && S.route.id === id) {
      updateShell();
      render();
    }
  } catch (error) {
    const view = $('#contenido');
    if (view) view.innerHTML = `<div class="empty"><div class="empty-illustration">${icon('alert')}</div><h3>No pude abrir la misión</h3><p>${esc(error.message)}</p><div class="empty-actions"><a class="btn btn-primary" href="#/misiones">Volver a misiones</a></div></div>`;
  } finally {
    S.missionLoading = null;
  }
}

function missionSkeleton() {
  return `<div class="card card-pad" style="margin-bottom:18px"><div class="progress"><div class="progress-bar" style="width:24%"></div></div><p class="muted small mt-2">Abriendo la sala de misión”¦</p></div>
    <div class="card card-pad" style="min-height:280px;display:grid;place-items:center"><div style="text-align:center"><span class="pulse" style="display:inline-block">${icon('spark', 'icon-xl')}</span><p class="muted small mt-2">Leyendo lo que produjo el equipo.</p></div></div>`;
}

function renderMissionView(id) {
  if (!S.mission || S.mission.mission?.id !== id) {
    loadMission(id);
    return missionSkeleton();
  }
  connectMission(id);
  return missionDetailHTML(S.mission);
}

function connectMission(id) {
  const mission = S.mission?.mission;
  if (!mission) return;
  if (!['queued', 'running'].includes(mission.status)) { disconnectMission(); return; }
  if (S.missionES && S.missionESId === id) return;
  disconnectMission();
  try {
    const es = new EventSource(`/api/missions/${encodeURIComponent(id)}/events`);
    S.missionES = es;
    S.missionESId = id;
    es.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data.type === 'mission' && data.mission) {
        if (!S.mission) { loadMission(id); return; }
        S.mission.mission = data.mission;
        S.mission.product = S.state.products.find((p) => p.id === data.mission.productId) || S.mission.product;
        if (['done', 'done_with_warnings', 'error', 'cancelled'].includes(data.mission.status)) {
          disconnectMission();
          loadState({ silent: true });
          refreshMissionAfterFinish(id);
        } else {
          repaintMission();
        }
      } else if (data.type === 'step') {
        if (!S.mission?.mission) { loadMission(id); return; }
        const step = arr(S.mission.mission.steps).find((s) => s.id === data.step?.id);
        if (step) Object.assign(step, data.step);
        if (data.artifact) {
          S.mission.mission.artifacts = { ...(S.mission.mission.artifacts || {}), [data.step.id]: data.artifact };
        }
        S.mission.mission.progress = data.progress ?? S.mission.mission.progress;
        S.mission.mission.status = data.status || S.mission.mission.status;
        repaintMission();
      }
    };
    es.onerror = () => {
      es.close();
      S.missionES = null;
      if (!S.missionPoll) {
        S.missionPoll = setInterval(() => refreshMissionAfterFinish(id), 4500);
      }
    };
  } catch {
    /* Sin SSE: la vista igual se puede refrescar a mano. */
  }
}

function disconnectMission() {
  if (S.missionES) { try { S.missionES.close(); } catch { /* noop */ } }
  S.missionES = null;
  S.missionESId = null;
  if (S.missionPoll) clearInterval(S.missionPoll);
  S.missionPoll = null;
}

async function refreshMissionAfterFinish(id) {
  try {
    const data = await api(`/api/missions/${encodeURIComponent(id)}`, { silent: true });
    S.mission = data;
    if (S.route.view === 'misiones' && S.route.id === id) repaintMission();
    const fresh = await api('/api/state', { silent: true });
    S.state = fresh;
    updateShell();
    scheduleAutoRefresh();
  } catch { /* noop */ }
}

function repaintMission() {
  if (S.route.view !== 'misiones' || !S.route.id) return;
  const y = window.scrollY;
  render();
  window.scrollTo({ top: y, behavior: 'auto' });
}

function missionDetailHTML(data) {
  const m = data.mission;
  const product = data.product || S.state.products.find((p) => p.id === m.productId);
  const steps = arr(m.steps);
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const synthesis = obj(m.artifacts?.synthesis);
  const summary = m.summary || synthesis.resumen || synthesis.decision || '';
  const threads = arr(data.threads);
  const status = m.status;
  const warnings = arr(m.warnings);
  const notices = arr(m.notices);
  const finished = ['done', 'done_with_warnings'].includes(status);
  const prospects = num(m.stats?.prospects) || arr(m.artifacts?.prospecting?.compradores).length;
  const verification = obj(m.artifacts?.prospecting?.verificacion);
  const noProspects = finished && !m.demo && prospects === 0;
  return `
    <div class="mission-hero">
      <div class="mission-hero-top">
        ${missionStatusBadge(status, m)}
        ${demoBadge(m.demo)}
        <span class="badge badge-neutral">${esc(DEPTHS[m.depth]?.label || m.depth)}</span>
        <span class="badge badge-neutral">${esc(GOALS.find((g) => g.id === m.goal)?.title || m.goal || 'Objetivo')}</span>
      </div>
      <h1>${esc(m.name)}</h1>
      <div class="mission-hero-sub">
        <span>${icon('box')} ${esc(product?.name || 'Producto')}</span>
        <span>${icon('globe')} ${esc((m.markets || []).join(' · ') || 'Mercado global')}</span>
        <span>${icon('clock')} ${esc(relTime(m.finishedAt || m.startedAt || m.createdAt))}</span>
        ${m.stats?.tokens ? `<span>${icon('chart')} ${numFmt(m.stats.tokens)} tokens</span>` : ''}
      </div>
    ${m.error ? `<div class="artifact-callout danger mt-3"><b>La misión se detuvo:</b> ${esc(m.error)}</div>` : ''}
    ${summary ? `<div class="mission-summary-callout"><b>${finished ? (warnings.length ? 'Resultado con avisos' : 'Resultado') : 'Enfoque'}:</b> ${esc(summary)}</div>` : ''}
      <div class="mission-hero-bottom">
        <div class="mission-hero-progress">
          <div class="progress"><div class="progress-bar ${status === 'done' ? 'ok' : status === 'done_with_warnings' ? 'warn' : status === 'error' ? 'danger' : ''}" style="width:${Math.max(2, num(m.progress))}%"></div></div>
          <div class="progress-label"><span>${noProspects ? 'Sin compradores' : doneCount === steps.length ? 'Terminada' : `${doneCount} de ${steps.length} pasos completados`}</span><b>${m.progress || 0}%</b></div>
        </div>
        <div class="mission-hero-actions">
          ${['queued', 'running'].includes(status) ? `<button class="btn btn-ghost btn-sm" type="button" data-action="mission-cancel" data-id="${attr(m.id)}">${icon('pause')} Cancelar</button>` : ''}
          ${['error', 'cancelled', 'done_with_warnings'].includes(status) ? `<button class="btn btn-accent btn-sm" type="button" data-action="mission-retry" data-id="${attr(m.id)}">${icon('refresh')} Reintentar</button>` : ''}
          ${finished && threads.length ? `<button class="btn btn-ghost btn-sm" type="button" data-action="mission-reconcile" data-id="${attr(m.id)}">${icon('refresh')} Revalidar borradores</button>` : ''}
          ${finished && threads.length ? `<a class="btn btn-accent btn-sm" href="#/bandeja">${icon('inbox')} Revisar ${threads.length} conversaciones</a>` : ''}
          ${!['queued', 'running'].includes(status) ? `<button class="btn btn-ghost btn-sm" type="button" data-action="mission-delete" data-id="${attr(m.id)}">${icon('trash')} Borrar</button>` : ''}
          <a class="btn btn-ghost btn-sm" href="#/misiones">${icon('arrowLeft')} Misiones</a>
        </div>
      </div>
    </div>

    ${noProspects ? `<div class="artifact-callout danger mt-3"><b>Esta misión no consiguió compradores verificados</b>
      <p class="mt-2">Se revisaron ${num(verification.candidatos) || 0} candidatos y se descartaron ${num(verification.descartados) || 0} por no poder comprobar que sean tiendas reales. No se creó ninguna conversación y no hay a quién venderle todavía: el plan puede servir, pero la venta no existe.</p>
      ${arr(m.artifacts?.prospecting?.busqueda?.errores).length ? `<p class="small mt-2"><b>La búsqueda web falló:</b> ${esc(m.artifacts.prospecting.busqueda.errores[0])}</p>` : ''}
      <div class="cluster mt-3">
        ${['error', 'cancelled', 'done_with_warnings', 'done'].includes(status) ? `<button class="btn btn-primary btn-sm" type="button" data-action="mission-retry" data-id="${attr(m.id)}">${icon('refresh')} Reintentar la misión</button>` : ''}
        <a class="btn btn-ghost btn-sm" href="#/ajustes?tab=busqueda">${icon('search')} Configurar búsqueda</a>
      </div>
    </div>` : ''}

    ${warnings.length ? `<div class="artifact-callout warn mt-3"><b>La misión terminó con ${warnings.length} aviso${warnings.length === 1 ? '' : 's'}</b><ul class="clean-list mt-2">${warnings.map((warning) => `<li><b>${esc(warning.title || warning.step)}</b>${warning.critical ? ' (paso crítico)' : ''}: ${esc(warning.error || 'Paso fallido.')}</li>`).join('')}</ul><p class="small muted mt-2">El plan final existe, pero conviene revisar estos pasos antes de confiar en los borradores. Al reintentar, se completan los pasos y los borradores existentes se reconcilian con la última revisión.</p></div>` : ''}
    ${notices.length ? `<div class="artifact-callout info mt-3"><b>Notas de la entrega</b><ul class="clean-list mt-2">${notices.map((notice) => `<li class="${notice.level === 'danger' ? 'text-danger' : notice.level === 'warn' ? 'text-warn' : ''}">${esc(notice.text || '')}</li>`).join('')}</ul></div>` : ''}

    <div class="mission-grid">
      <div>
        <div class="section-head">
          <div><h2 class="section-title">El trabajo, paso a paso</h2><p class="section-sub">Hacé clic en cada paso para leer el resultado completo.</p></div>
        </div>
        <div class="timeline">
          ${steps.map((step, index) => missionStepHTML(step, index, m)).join('')}
        </div>
        ${status === 'error' ? `<div class="artifact-callout danger mt-3"><b>La misión se detuvo</b>${esc(m.error || 'Revisá el paso con error y reintentá.')}</div>` : ''}
      </div>
      <aside class="mission-aside">
        <div class="card">
          <p class="aside-title">Producto</p>
          <div style="display:flex;gap:10px;align-items:center">
            ${productThumb(product)}
            <div style="min-width:0"><b style="font-size:12.5px">${esc(product?.name || 'Producto')}</b><p class="tiny muted">${esc(product?.code || '')} · ${esc(money(product?.price, product?.currency))}</p></div>
          </div>
          ${product ? `<a class="btn btn-ghost btn-sm btn-block mt-3" href="#/productos">${icon('edit')} Ver ficha</a>` : ''}
        </div>
        <div class="card">
          <p class="aside-title">Números de la misión</p>
          <div class="mini-metrics">
            <div class="mini-metric"><b>${m.stats?.calls || doneCount}</b><span>Llamadas IA</span></div>
            <div class="mini-metric"><b>${numFmt(m.stats?.tokens || steps.reduce((acc, s) => acc + num(s.tokens), 0))}</b><span>Tokens</span></div>
            <div class="mini-metric"><b>${m.stats?.prospects || arr(m.artifacts?.prospecting?.compradores).length}</b><span>Compradores</span></div>
            <div class="mini-metric"><b>${m.stats?.messages ?? arr(m.artifacts?.outreach?.mensajes).length}</b><span>Mensajes</span></div>
          </div>
        </div>
        <div class="card">
          <p class="aside-title">Registro en vivo</p>
          <div class="log">
            ${arr(m.log).length ? arr(m.log).slice(-10).map((l) => `<div class="log-item"><span class="log-time">${esc(new Date(l.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))}</span>${esc(l.text)}</div>`).join('') : '<p class="small muted">El registro aparece cuando el equipo empieza a trabajar.</p>'}
          </div>
        </div>
        ${threads.length ? `<div class="card">
          <p class="aside-title">Conversaciones creadas</p>
          <div class="stack">${threads.slice(0, 6).map((t) => `<a href="#/bandeja/${encodeURIComponent(t.id)}" style="text-decoration:none;display:flex;gap:8px;align-items:center">
            <span class="avatar sm">${esc(initials(t.contact?.company || '?'))}</span>
            <span style="min-width:0;flex:1"><b style="display:block;font-size:11.5px" class="truncate">${esc(t.contact?.company || 'Contacto')}</b><span class="tiny muted">${esc(STAGES[t.stage] || t.stage)} · ${t.draftCount || 0} borradores</span></span>
            ${icon('chevronRight', 'icon-sm')}
          </a>`).join('')}</div>
          <a class="btn btn-ghost btn-sm btn-block mt-3" href="#/bandeja">${icon('inbox')} Abrir bandeja</a>
        </div>` : ''}
      </aside>
    </div>`;
}

function missionStepHTML(step, index, mission) {
  const agent = agentById(step.agent);
  const open = S.ui.openSteps.has(step.id);
  const status = step.status || 'pending';
  const artifact = mission.artifacts?.[step.id];
  const canOpen = status === 'done' && artifact;
  return `<div class="timeline-item ${status} ${open ? 'open' : ''}">
    <div class="timeline-rail">
      <span class="timeline-dot">${status === 'done' ? icon('check', 'icon-sm') : status === 'error' ? icon('alert', 'icon-sm') : status === 'running' ? icon('refresh', 'icon-sm spin') : String(index + 1).padStart(2, '0')}</span>
    </div>
    <div class="timeline-card">
      <div class="timeline-head" ${canOpen ? `data-action="toggle-step" data-id="${attr(step.id)}" role="button" tabindex="0" aria-expanded="${open}"` : ''}>
        ${agentAvatar(step.agent)}
        <div class="timeline-head-text">
          <div class="timeline-kicker">
            <span class="timeline-title">${esc(step.title || step.id)}</span>
            ${step.critical ? '<span class="badge badge-amber">Clave</span>' : ''}
            ${status === 'running' ? '<span class="badge badge-info">Trabajando</span>' : ''}
            ${status === 'pending' ? '<span class="badge badge-neutral">En espera</span>' : ''}
            ${status === 'error' ? '<span class="badge badge-danger">Error</span>' : ''}
          </div>
          <div class="timeline-agent">${esc(agent.name)}</div>
          ${step.summary ? `<p class="timeline-summary">${esc(step.summary)}</p>` : ''}
          ${status === 'error' && step.error ? `<p class="timeline-summary" style="color:var(--danger)">${esc(step.error)}</p>` : ''}
          <div class="timeline-meta">
            ${step.durationMs ? `<span>${icon('clock')} ${Math.max(1, Math.round(step.durationMs / 1000))} s</span>` : ''}
            ${step.tokens ? `<span>${icon('chart')} ${numFmt(step.tokens)} tokens</span>` : ''}
            ${canOpen ? `<span>${open ? 'Cerrar detalle' : 'Leer resultado'}</span>` : ''}
          </div>
        </div>
        ${canOpen ? `<span class="timeline-toggle">${icon('chevronDown')}</span>` : status === 'running' ? `<span class="timeline-toggle pulse">${icon('spark')}</span>` : ''}
      </div>
      ${open ? `<div class="timeline-body"><div class="timeline-body-inner">${canOpen ? renderArtifact(step.id, artifact) : '<p class="small muted">Todavía no hay resultado para este paso.</p>'}</div></div>` : ''}
    </div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   13. Renderizadores de artefactos
   ───────────────────────────────────────────────────────────── */

function asText(value, fallback = 'sin dato') {
  if (Array.isArray(value)) return value.map((v) => asText(v, '')).filter(Boolean).join(' · ') || fallback;
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${asText(v, '')}`).join(' · ');
  }
  return value === null || value === undefined || value === '' ? fallback : String(value);
}
function riskBadge(level) {
  const l = String(level || 'medio').toLowerCase();
  const cls = ['alto', 'alta'].includes(l) ? 'alto' : ['bajo', 'baja'].includes(l) ? 'bajo' : 'medio';
  return `<span class="risk ${cls}">${esc(level || 'medio')}</span>`;
}
function sourceLink(url, label = 'fuente') {
  const safe = safeUrl(url);
  if (!safe) return url ? `<span class="artifact-source">${esc(url)}</span>` : '';
  return `<span class="artifact-source"><a href="${attr(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon('external', 'icon-sm')}</a></span>`;
}
function kvBlock(rows) {
  const valid = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!valid.length) return '';
  return `<dl class="artifact-kv">${valid.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(asText(v))}</dd></div>`).join('')}</dl>`;
}
function listBlock(items, { numbered = false } = {}) {
  const list = arr(items).filter((i) => i !== null && i !== undefined && i !== '');
  if (!list.length) return '';
  return `<ul class="artifact-list ${numbered ? 'numbered' : ''}">${list.map((item) => `<li>${esc(asText(item))}</li>`).join('')}</ul>`;
}
function tableBlock(headers, rows) {
  if (!arr(rows).length) return '';
  return `<div class="artifact-table-wrap"><table class="artifact-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${typeof cell === 'number' ? 'num' : ''}">${i === row.length - 1 && typeof cell === 'string' && /^https?:/.test(cell) ? sourceLink(cell, 'abrir') : esc(cell ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function artifactCard(title, body, badge = '') {
  return `<div class="artifact-card">${badge}${title ? `<h5>${esc(title)}</h5>` : ''}<p>${body}</p></div>`;
}
function copyButton(textValue, label = 'Copiar', extra = '') {
  const id = `copy-${Math.random().toString(36).slice(2, 9)}`;
  return `<textarea id="${id}" class="sr-only" readonly>${esc(textValue)}</textarea><button class="btn btn-ghost btn-xs" type="button" data-action="copy-el" data-target="${id}">${icon('copy')} ${esc(label)}${extra}</button>`;
}

function renderArtifact(stepId, artifact) {
  const a = obj(artifact);
  switch (stepId) {
    case 'brief': return artifactBrief(a);
    case 'research': return artifactResearch(a);
    case 'customs': return artifactCustoms(a);
    case 'pricing': return artifactPricing(a);
    case 'prospecting': return artifactProspecting(a);
    case 'enrichment': return artifactEnrichment(a);
    case 'outreach': return artifactOutreach(a);
    case 'content': return artifactContent(a);
    case 'compliance': return artifactCompliance(a);
    case 'redteam': return artifactRedteam(a);
    case 'revision': return artifactRevision(a);
    case 'synthesis': return artifactSynthesis(a);
    case 'learning': return artifactLearning(a);
    default: return `<pre>${esc(JSON.stringify(a, null, 2))}</pre>`;
  }
}

function artifactBrief(a) {
  return `<div class="artifact">
    ${a.tesis ? `<div class="artifact-lead"><b style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--amber-deep);margin-bottom:4px">Tesis comercial</b>${esc(a.tesis)}</div>` : ''}
    ${a.propuesta_de_valor ? `<div class="artifact-section"><h4>Propuesta de valor</h4><p>${esc(a.propuesta_de_valor)}</p></div>` : ''}
    ${a.publico_primario ? `<div class="artifact-section"><h4>Público primario</h4><p>${esc(a.publico_primario)}</p></div>` : ''}
    ${arr(a.publicos_secundarios).length ? `<div class="artifact-section"><h4>Públicos secundarios</h4>${listBlock(a.publicos_secundarios)}</div>` : ''}
    ${arr(a.paises).length ? `<div class="artifact-section"><h4>Países y canales</h4><div class="country-grid">${a.paises.map((p) => artifactCard(p.pais, `${esc(p.motivo || '')}${p.canal ? `<br><b>Canal:</b> ${esc(p.canal)}` : ''}`, p.dificultad ? `<span class="badge badge-${p.dificultad === 'alta' ? 'danger' : p.dificultad === 'baja' ? 'ok' : 'warn'}">${esc(p.dificultad)}</span>` : '')).join('')}</div></div>` : ''}
    ${arr(a.angulos).length ? `<div class="artifact-section"><h4>Ãngulos</h4><div class="artifact-grid-2">${a.angulos.map((x) => artifactCard(x.angulo, x.prueba || '', x.uso ? `<span class="badge badge-neutral">${esc(x.uso)}</span>` : '')).join('')}</div></div>` : ''}
    ${arr(a.riesgos).length ? `<div class="artifact-callout warn"><b>Riesgos que hay que mirar</b>${listBlock(a.riesgos)}</div>` : ''}
    ${arr(a.supuestos).length ? `<div class="artifact-section"><h4>Supuestos</h4>${listBlock(a.supuestos)}</div>` : ''}
    ${arr(a.preguntas_abiertas).length ? `<div class="artifact-section"><h4>Preguntas abiertas</h4>${listBlock(a.preguntas_abiertas)}</div>` : ''}
    ${a.criterio_de_exito ? `<div class="artifact-callout ok"><b>Criterio de éxito</b>${esc(a.criterio_de_exito)}</div>` : ''}
  </div>`;
}

function artifactResearch(a) {
  return `<div class="artifact">
    ${a.panorama ? `<div class="artifact-lead">${esc(a.panorama)}</div>` : ''}
    ${arr(a.tendencias).length ? `<div class="artifact-section"><h4>Tendencias</h4><div class="artifact-grid-2">${a.tendencias.map((t) => artifactCard(t.tendencia, `${esc(t.evidencia || '')}${t.fuente ? `<br>${sourceLink(t.fuente)}` : ''}`, t.fuente ? `<span class="badge ${t.fuente_verificada ? 'badge-ok' : 'badge-warn'}">${t.fuente_verificada ? 'Confirmado en fuente' : 'Hipótesis del modelo'}</span>` : '')).join('')}</div></div>` : ''}
    ${arr(a.competidores).length ? `<div class="artifact-section"><h4>Competencia</h4>${tableBlock(['Competidor', 'País', 'Precio', 'Canal', 'Fortaleza', 'Hueco', 'Fuente'], a.competidores.map((c) => [c.nombre, c.pais, c.precio, c.canal, c.fortaleza, c.hueco, c.fuente ? `<span class="badge ${c.fuente_verificada ? 'badge-ok' : 'badge-warn'}">${c.fuente_verificada ? 'Confirmado' : 'Hipótesis'}</span>` : '””']))}</div>` : ''}
    ${obj(a.demanda).senales?.length || a.demanda?.temporadas || a.demanda?.terminos?.length ? `<div class="artifact-section"><h4>Demanda</h4>${listBlock(a.demanda.senales)}${a.demanda.temporadas ? `<p class="small"><b>Temporadas:</b> ${esc(a.demanda.temporadas)}</p>` : ''}${arr(a.demanda.terminos).length ? `<div class="artifact-chips">${a.demanda.terminos.map((t) => `<span class="artifact-chip">${esc(t)}</span>`).join('')}</div>` : ''}</div>` : ''}
    ${arr(a.canales).length ? `<div class="artifact-section"><h4>Canales</h4><div class="artifact-grid-2">${a.canales.map((c) => artifactCard(c.canal, `${esc(c.por_que || '')}${c.esfuerzo ? `<br><b>Esfuerzo:</b> ${esc(c.esfuerzo)}` : ''}`)).join('')}</div></div>` : ''}
    ${a.conclusion ? `<div class="artifact-callout"><b>Conclusión</b>${esc(a.conclusion)}</div>` : ''}
    ${arr(a.fuentes).length ? `<div class="artifact-section"><h4>Fuentes</h4><div class="sources-list">${a.fuentes.map((f) => `<div class="source-row">${icon('link')}<div><a href="${attr(safeUrl(f.url) || '#')}" target="_blank" rel="noopener noreferrer">${esc(f.titulo || f.url)}</a><span>${esc(f.url || '')}</span></div></div>`).join('')}</div></div>` : ''}
  </div>`;
}

function artifactCustoms(a) {
  return `<div class="artifact">
    ${a.resumen ? `<div class="artifact-lead">${esc(a.resumen)}</div>` : ''}
    ${arr(a.paises).length ? `<div class="artifact-section"><h4>País por país</h4><div class="country-grid">${a.paises.map((p) => `<div class="country-card">
      <div class="country-card-head"><h5>${esc(p.pais)}</h5>${riskBadge(p.riesgo)}${p.fuente ? `<span class="badge ${p.fuente_verificada ? 'badge-ok' : 'badge-warn'}">${p.fuente_verificada ? 'Confirmado en fuente' : 'Hipótesis del modelo'}</span>` : ''}</div>
      <div class="country-line"><span>HS</span><b>${esc(p.codigo_hs || 'sin dato')}</b></div>
      <div class="country-line"><span>Arancel</span><b>${esc(p.arancel_estimado || 'sin dato')}</b></div>
      <div class="country-line"><span>Impuestos</span><b>${esc(p.impuestos || 'sin dato')}</b></div>
      <div class="country-line"><span>Incoterm</span><b>${esc(p.incoterm || 'sin dato')}</b></div>
      <div class="country-line"><span>Courier</span><b>${esc(p.courier || 'sin dato')}</b></div>
      ${arr(p.certificaciones).length ? `<div class="artifact-chips mt-2">${p.certificaciones.map((c) => `<span class="artifact-chip">${esc(c)}</span>`).join('')}</div>` : ''}
      ${arr(p.requisitos).length ? `<div class="mt-2">${listBlock(p.requisitos)}</div>` : ''}
      ${p.notas ? `<p class="tiny muted mt-2">${esc(p.notas)}</p>` : ''}
      ${p.fuente ? `<div class="mt-2">${sourceLink(p.fuente)}</div>` : ''}
    </div>`).join('')}</div></div>` : ''}
    ${arr(a.documentos).length ? `<div class="artifact-section"><h4>Documentos</h4>${listBlock(a.documentos)}</div>` : ''}
    ${a.advertencia ? `<div class="artifact-callout danger"><b>Advertencia</b>${esc(a.advertencia)}</div>` : ''}
  </div>`;
}

function artifactPricing(a) {
  const scenarios = arr(a.escenarios);
  return `<div class="artifact">
    ${a.recomendacion ? `<div class="artifact-lead"><b style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--amber-deep);margin-bottom:4px">Recomendación</b>${esc(a.recomendacion)}</div>` : ''}
    ${scenarios.length ? `<div class="price-hero">${scenarios.slice(0, 3).map((s, i) => `<div class="price-tile ${i === 0 ? 'hot' : ''}"><span>${esc(s.canal || `Canal ${i + 1}`)}</span><b>${esc(money(s.precio, a.moneda || 'USD'))}</b><em>${num(s.margen_pct) ? `${num(s.margen_pct)}% margen` : ''}</em></div>`).join('')}</div>` : ''}
    ${obj(a.costos) && Object.keys(a.costos).length ? `<div class="artifact-section"><h4>Costos</h4><div class="artifact-kv">${Object.entries(a.costos).map(([k, v]) => `<div><dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(typeof v === 'number' ? money(v, a.moneda || 'USD') : v)}</dd></div>`).join('')}</div></div>` : ''}
    ${scenarios.length ? `<div class="artifact-section"><h4>Escenarios</h4><div class="scenario-grid">${scenarios.map((s) => `<div class="scenario"><h5>${esc(s.canal)}</h5><b>${esc(money(s.precio, a.moneda || 'USD'))}</b><div class="margin-pill">${num(s.margen_pct)}% margen</div><p>${esc(s.notas || '')}${s.ganancia ? `<br>Ganancia: ${esc(money(s.ganancia, a.moneda || 'USD'))}` : ''}</p></div>`).join('')}</div></div>` : ''}
    ${arr(a.landed_cost).length ? `<div class="artifact-section"><h4>Costo aterrizado</h4>${tableBlock(['País', 'Costo puesto en destino', 'Supuestos', 'Fuente'], a.landed_cost.map((l) => [l.pais, money(l.costo_puesto_destino || l.costo, a.moneda || 'USD'), l.supuestos, '<span class="badge badge-ok">Calculado en código</span>']))}</div>` : ''}
    ${arr(a.descuentos).length ? `<div class="artifact-section"><h4>Descuentos</h4>${tableBlock(['Tipo', 'Condición', 'Límite'], a.descuentos.map((d) => [d.tipo, d.condicion, d.limite]))}</div>` : ''}
    ${a.psicologia ? `<div class="artifact-callout"><b>Psicología de precio</b>${esc(a.psicologia)}</div>` : ''}
    ${arr(a.supuestos).length ? `<div class="artifact-section"><h4>Supuestos del modelo</h4>${listBlock(a.supuestos)}</div>` : ''}
    ${a.advertencia ? `<div class="artifact-callout warn"><b>Ojo</b>${esc(a.advertencia)}</div>` : ''}
  </div>`;
}

function artifactProspecting(a) {
  const buyers = arr(a.compradores);
  return `<div class="artifact">
    ${arr(a.segmentos).length ? `<div class="artifact-section"><h4>Segmentos</h4><div class="artifact-grid-2">${a.segmentos.map((s) => artifactCard(s.segmento, `${esc(s.por_que || '')}${arr(s.donde_buscar).length ? `<br><b>Dónde:</b> ${esc(s.donde_buscar.join(', '))}` : ''}${s.volumen ? `<br><b>Volumen:</b> ${esc(s.volumen)}` : ''}`)).join('')}</div></div>` : ''}
    ${buyers.length ? `<div class="artifact-section"><h4>Compradores concretos</h4><div class="buyer-list">${buyers.map((b) => {
      const match = S.state.threads.find((t) => t.contact?.company && b.nombre && t.contact.company.toLowerCase() === String(b.nombre).toLowerCase());
      return `<div class="buyer-row">
        <div>
          <h5>${esc(b.nombre)} <span class="buyer-priority ${esc(b.prioridad || 'media')}">${esc(b.prioridad || 'media')}</span>${b.demo ? demoBadge(true) : ''}</h5>
          <p>${esc(b.por_que || '')}</p>
          <div class="buyer-meta"><span>${esc(b.tipo || '')}</span><span>${esc(b.pais || '')}${b.ciudad ? ` · ${esc(b.ciudad)}` : ''}</span>${b.contacto ? `<span>${esc(b.contacto)}</span>` : ''}</div>
        </div>
        <div class="buyer-links">
          ${b.email ? `<a href="mailto:${attr(b.email)}">${esc(b.email)}</a>` : '<span class="no-email">sin email verificado</span>'}
          ${b.web ? `<a href="${attr(safeUrl(b.web) || '#')}" target="_blank" rel="noopener noreferrer">${esc(truncate(b.web, 38))}</a>` : ''}
          ${match ? `<a href="#/bandeja/${encodeURIComponent(match.id)}">Abrir conversación ${icon('arrowRight', 'icon-sm')}</a>` : ''}
        </div>
      </div>`;
    }).join('')}</div></div>` : ''}
    ${arr(a.canales).length ? `<div class="artifact-section"><h4>Canales</h4><div class="artifact-grid-2">${a.canales.map((c) => artifactCard(c.canal, `${esc(c.como || '')}${c.esfuerzo ? `<br><b>Esfuerzo:</b> ${esc(c.esfuerzo)} · <b>Retorno:</b> ${esc(c.retorno || '')}` : ''}`)).join('')}</div></div>` : ''}
    ${arr(a.proximos_pasos).length ? `<div class="artifact-section"><h4>Próximos pasos</h4>${listBlock(a.proximos_pasos, { numbered: true })}</div>` : ''}
    ${arr(a.faltantes).length ? `<div class="artifact-callout warn"><b>Lo que falta</b>${listBlock(a.faltantes)}</div>` : ''}
  </div>`;
}

function artifactEnrichment(a) {
  return `<div class="artifact">
    ${kvBlock([['Revisados', a.revisados], ['Con email', a.encontrados], ['Verificados', a.verificados], ['Sin contacto', a.sin_contacto]])}
    ${a.metodo ? `<p class="small muted">${esc(a.metodo)}</p>` : ''}
    ${arr(a.detalle).length ? `<div class="artifact-section"><h4>Detalle</h4>${tableBlock(['Comprador', 'Email', 'Estado', 'Nota'], a.detalle.map((d) => [d.comprador, d.email || '””', d.estado, d.nota]))}</div>` : ''}
    ${a.demo ? '<p class="artifact-footnote">Datos de ejemplo. En una misión real, las direcciones se buscan en sitios públicos y Hunter; no se inventan emails.</p>' : ''}
  </div>`;
}

function artifactOutreach(a) {
  const messages = arr(a.mensajes);
  return `<div class="artifact">
    ${a.estrategia ? `<div class="artifact-lead">${esc(a.estrategia)}</div>` : ''}
    ${messages.length ? `<div class="artifact-section"><h4>Mensajes personalizados</h4><div class="stack">${messages.map((m, index) => `<div class="message-card">
      <div class="message-card-head"><div><div class="message-subject">${esc(m.asunto || '(sin asunto)')}</div><div class="message-meta">${esc(m.comprador || '')}${m.pais ? ` · ${esc(m.pais)}` : ''}${m.idioma ? ` · ${esc(m.idioma)}` : ''}</div></div><span class="badge badge-neutral">${esc(m.idioma || 'es')}</span></div>
      <div class="message-body">${esc(m.cuerpo || '')}</div>
      ${m.cta ? `<div class="message-meta"><b>CTA:</b> ${esc(m.cta)}</div>` : ''}
      <div class="message-actions">${copyButton(`${m.asunto ? `Asunto: ${m.asunto}\n\n` : ''}${m.cuerpo || ''}`, 'Copiar correo')}</div>
    </div>`).join('')}</div></div>` : ''}
    ${arr(a.secuencia).length ? `<div class="artifact-section"><h4>Secuencia</h4><div class="plan-days">${a.secuencia.map((s) => `<div class="plan-day"><span class="plan-num">${esc(s.dia ?? s.paso ?? '·')}</span><div class="plan-content"><h5>${esc(s.objetivo || s.asunto || '')}</h5>${s.asunto ? `<p><b>Asunto:</b> ${esc(s.asunto)}</p>` : ''}${s.cuerpo ? `<div class="message-body" style="margin-top:5px">${esc(s.cuerpo)}</div>` : ''}</div></div>`).join('')}</div></div>` : ''}
    ${arr(a.whatsapp).length ? `<div class="artifact-section"><h4>WhatsApp / DM</h4><div class="stack">${a.whatsapp.map((w) => `<div class="message-card"><div class="message-subject">${esc(w.comprador || '')}</div><div class="message-body">${esc(w.mensaje || '')}</div><div class="message-actions">${copyButton(w.mensaje || '', 'Copiar mensaje')}</div></div>`).join('')}</div></div>` : ''}
    ${arr(a.objeciones).length ? `<div class="artifact-section"><h4>Objeciones y respuestas</h4><div class="stack">${a.objeciones.map((o) => `<div class="artifact-card"><h5>“${esc(o.objecion || '')}”</h5><p>${esc(o.respuesta || '')}</p></div>`).join('')}</div></div>` : ''}
    ${arr(a.reglas).length ? `<div class="artifact-section"><h4>Reglas de envío</h4>${listBlock(a.reglas)}</div>` : ''}
    ${a.firma ? `<div class="artifact-section"><h4>Firma</h4><div class="artifact-quote">${nl2br(a.firma)}</div></div>` : ''}
    ${a.demo ? '<p class="artifact-footnote">Mensajes de ejemplo. No se enviaron a nadie. Revisalos antes de usar un correo real.</p>' : ''}
  </div>`;
}

function artifactContent(a) {
  return `<div class="artifact">
    ${arr(a.pilares).length ? `<div class="artifact-section"><h4>Pilares</h4><div class="artifact-grid-2">${a.pilares.map((p) => artifactCard(p.pilar, p.idea || '')).join('')}</div></div>` : ''}
    ${arr(a.calendario).length ? `<div class="artifact-section"><h4>Calendario</h4><div class="stack">${a.calendario.map((c) => `<div class="content-card">
      <div class="content-top"><div><div class="content-platform">${icon('image')} ${esc(c.plataforma || '')} · ${esc(c.formato || '')}</div><div class="content-hook">${esc(c.gancho || '')}</div></div><span class="content-day">${esc(c.dia || '')}</span></div>
      ${c.guion ? `<p class="content-script"><b>Guion:</b> ${esc(c.guion)}</p>` : ''}
      ${c.caption ? `<div class="content-caption">${esc(c.caption)}</div>` : ''}
      ${arr(c.hashtags).length ? `<div class="hashtags">${c.hashtags.map((h) => `<span>${esc(h)}</span>`).join('')}</div>` : ''}
      <div class="content-foot"><span class="content-cta"><b>CTA:</b> ${esc(c.cta || '””')}</span>${copyButton(`${c.gancho || ''}\n\n${c.caption || ''}\n\n${arr(c.hashtags).join(' ')}`, 'Copiar pieza')}</div>
    </div>`).join('')}</div></div>` : ''}
    ${a.serie ? `<div class="artifact-callout"><b>Serie: ${esc(a.serie.nombre || '')}</b>${esc(a.serie.descripcion || '')}${arr(a.serie.episodios).length ? `<div class="artifact-chips mt-2">${a.serie.episodios.map((e) => `<span class="artifact-chip">${esc(e)}</span>`).join('')}</div>` : ''}</div>` : ''}
    ${arr(a.ganchos).length ? `<div class="artifact-section"><h4>Ganchos</h4>${listBlock(a.ganchos)}</div>` : ''}
    ${arr(a.fotos).length ? `<div class="artifact-section"><h4>Fotos que faltan</h4><div class="stack">${a.fotos.map((f) => `<div class="artifact-card"><h5>${esc(f.toma || '')}</h5><p>${esc(f.por_que || '')}</p></div>`).join('')}</div></div>` : ''}
    ${a.advertencia ? `<div class="artifact-callout warn"><b>Advertencia</b>${esc(a.advertencia)}</div>` : ''}
  </div>`;
}

function artifactCompliance(a) {
  const verdict = String(a.veredicto || '').toLowerCase();
  const tone = verdict.includes('rechaz') ? 'danger' : verdict.includes('cambio') ? 'warn' : 'ok';
  return `<div class="artifact">
    ${a.veredicto ? `<div class="artifact-callout ${tone}"><b>Veredicto: ${esc(a.veredicto.replace(/_/g, ' '))}</b>Revisión de claims, privacidad y reputación.</div>` : ''}
    ${arr(a.riesgos).length ? `<div class="artifact-section"><h4>Riesgos</h4><div class="stack">${a.riesgos.map((r) => `<div class="artifact-card">${riskBadge(r.nivel)}<h5>${esc(r.tema || '')}</h5><p>${esc(r.detalle || '')}</p>${r.arreglo ? `<p style="margin-top:5px;color:var(--ok)"><b>Arreglo:</b> ${esc(r.arreglo)}</p>` : ''}</div>`).join('')}</div></div>` : ''}
    ${arr(a.claims_a_evitar).length ? `<div class="artifact-callout danger"><b>Claims a evitar</b>${listBlock(a.claims_a_evitar)}</div>` : ''}
    ${obj(a.email) && Object.keys(a.email).length ? `<div class="artifact-section"><h4>Correo y datos</h4>${kvBlock([['Base legal', a.email.base_legal], ['Opt-out', a.email.opt_out], ['Datos personales', a.email.datos_personales]])}</div>` : ''}
    ${arr(a.correcciones).length ? `<div class="artifact-section"><h4>Correcciones sugeridas</h4>${tableBlock(['Original', 'Sugerido'], a.correcciones.map((c) => [c.original, c.sugerido]))}</div>` : ''}
    ${arr(a.checklist).length ? `<div class="artifact-section"><h4>Checklist</h4><div class="stack">${a.checklist.map((c) => `<div style="display:flex;gap:8px;align-items:flex-start;font-size:12px"><span style="color:${c.ok ? 'var(--ok)' : 'var(--danger)'};flex:none;margin-top:1px">${icon(c.ok ? 'check' : 'x', 'icon-sm')}</span><span>${esc(c.item || '')}</span></div>`).join('')}</div></div>` : ''}
    ${arr(a.aduanas).length ? `<div class="artifact-section"><h4>Aduanas</h4>${listBlock(a.aduanas)}</div>` : ''}
  </div>`;
}

function artifactRedteam(a) {
  return `<div class="artifact">
    ${a.sello ? `<div class="artifact-quote">${esc(a.sello)}</div>` : ''}
    ${a.veredicto ? `<div class="artifact-callout warn"><b>Veredicto: ${esc(a.veredicto)}</b>El plan necesita estos ajustes antes de salir.</div>` : ''}
    ${arr(a.supuestos_fragiles).length ? `<div class="artifact-section"><h4>Supuestos frágiles</h4><div class="stack">${a.supuestos_fragiles.map((s) => `<div class="artifact-card"><h5>${esc(s.supuesto || '')}</h5><p><b>Por qué falla:</b> ${esc(s.por_que_falla || '')}</p>${s.prueba_barata ? `<p style="color:var(--ok);margin-top:5px"><b>Prueba barata:</b> ${esc(s.prueba_barata)}</p>` : ''}</div>`).join('')}</div></div>` : ''}
    ${arr(a.agujeros).length ? `<div class="artifact-section"><h4>Agujeros</h4>${tableBlock(['Ãrea', 'Problema', 'Impacto', 'Arreglo'], a.agujeros.map((h) => [h.area, h.problema, h.impacto, h.arreglo]))}</div>` : ''}
    ${arr(a.escenarios).length ? `<div class="artifact-section"><h4>Escenarios</h4><div class="artifact-grid-2">${a.escenarios.map((e) => artifactCard(e.escenario, `<b>Probabilidad:</b> ${esc(e.probabilidad || '')}<br><b>Plan B:</b> ${esc(e.plan_b || '')}`)).join('')}</div></div>` : ''}
    ${arr(a.preguntas_dificiles).length ? `<div class="artifact-section"><h4>Preguntas difíciles</h4>${listBlock(a.preguntas_dificiles)}</div>` : ''}
    ${arr(a.lo_que_sobra).length ? `<div class="artifact-callout danger"><b>Lo que sobra</b>${listBlock(a.lo_que_sobra)}</div>` : ''}
  </div>`;
}

function artifactRevision(a) {
  return `<div class="artifact">
    ${arr(a.cambios).length ? `<div class="artifact-section"><h4>Cambios aplicados</h4><div class="stack">${a.cambios.map((c) => `<div class="artifact-card"><h5>${esc(c.que || '')}</h5><p>${esc(c.por_que || '')}</p></div>`).join('')}</div></div>` : ''}
    ${arr(a.mensajes).length ? `<div class="artifact-section"><h4>Mensajes corregidos</h4><div class="stack">${a.mensajes.map((m) => `<div class="message-card"><div class="message-subject">${esc(m.asunto || '')}</div><div class="message-meta">${esc(m.comprador || '')}</div><div class="message-body">${esc(m.cuerpo || '')}</div><div class="message-actions">${copyButton(`${m.asunto || ''}\n\n${m.cuerpo || ''}`, 'Copiar correo')}</div></div>`).join('')}</div></div>` : ''}
    ${arr(a.ajustes_plan).length ? `<div class="artifact-section"><h4>Ajustes al plan</h4>${listBlock(a.ajustes_plan)}</div>` : ''}
    ${arr(a.riesgos_que_quedan).length ? `<div class="artifact-callout warn"><b>Riesgos que quedan</b>${listBlock(a.riesgos_que_quedan)}</div>` : ''}
  </div>`;
}

function artifactSynthesis(a) {
  return `<div class="artifact">
    ${a.decision ? `<div class="artifact-lead" style="font-size:16px"><b style="display:block;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--amber-deep);margin-bottom:4px">Decisión</b>${esc(a.decision)}</div>` : ''}
    ${a.tesis ? `<div class="artifact-quote">${esc(a.tesis)}</div>` : ''}
    ${arr(a.plan_7_dias).length ? `<div class="artifact-section"><h4>Plan de 7 días</h4><div class="plan-days">${a.plan_7_dias.map((d, i) => `<div class="plan-day"><span class="plan-num">${esc(d.dia || i + 1)}</span><div class="plan-content"><h5>${esc(d.accion || '')}</h5>${d.resultado ? `<p>${esc(d.resultado)}</p>` : ''}<div class="plan-meta">${d.tiempo ? `<span>${icon('clock')} ${esc(d.tiempo)}</span>` : ''}</div></div></div>`).join('')}</div></div>` : ''}
    ${arr(a.prioridades).length ? `<div class="artifact-section"><h4>Prioridades</h4><div class="stack">${a.prioridades.map((p) => `<div class="artifact-card"><span class="badge badge-amber">Prioridad ${esc(p.prioridad || '')}</span><h5>${esc(p.accion || '')}</h5><p>${esc(p.por_que || '')}${p.metrica ? `<br><b>Métrica:</b> ${esc(p.metrica)}` : ''}</p></div>`).join('')}</div></div>` : ''}
    ${arr(a.metricas).length ? `<div class="artifact-section"><h4>Métricas</h4>${tableBlock(['Métrica', 'Meta', 'Cuándo'], a.metricas.map((m) => [m.metrica, m.meta, m.cuando]))}</div>` : ''}
    ${obj(a.presupuesto) && Object.keys(a.presupuesto).length ? `<div class="artifact-section"><h4>Presupuesto</h4>${kvBlock([['Inversión', typeof a.presupuesto.inversion === 'number' ? money(a.presupuesto.inversion, 'USD') : a.presupuesto.inversion], ['Detalle', a.presupuesto.detalle], ['Retorno esperado', a.presupuesto.retorno_esperado]])}</div>` : ''}
    ${arr(a.mensajes_listos).length ? `<div class="artifact-section"><h4>Mensajes listos</h4><div class="stack">${a.mensajes_listos.map((m) => `<div class="message-card"><div class="message-subject">${esc(m.asunto || '')}</div><div class="message-meta">${esc(m.comprador || '')}</div><div class="message-body">${esc(m.cuerpo || '')}</div><div class="message-actions">${copyButton(`${m.asunto || ''}\n\n${m.cuerpo || ''}`, 'Copiar correo')}</div></div>`).join('')}</div></div>` : ''}
    ${arr(a.no_hacer).length ? `<div class="artifact-callout danger"><b>No hacer</b>${listBlock(a.no_hacer)}</div>` : ''}
    ${a.resumen ? `<div class="artifact-section"><h4>Resumen</h4><p>${esc(a.resumen)}</p></div>` : ''}
  </div>`;
}

function artifactLearning(a) {
  return `<div class="artifact">
    ${arr(a.aprendizajes).length ? `<div class="stack">${a.aprendizajes.map((l) => `<div class="learning-card" style="grid-template-columns:1fr"><div><p class="learning-insight">${esc(l.insight || '')}</p>${l.evidencia ? `<p class="learning-evidence"><b>Evidencia:</b> ${esc(l.evidencia)}</p>` : ''}${l.aplicar ? `<p class="learning-apply"><b>Aplicar:</b> ${esc(l.aplicar)}</p>` : ''}<div class="learning-meta"><span class="badge badge-neutral">${esc(l.etiqueta || l.tag || 'general')}</span><span class="badge badge-${l.confianza === 'alta' ? 'ok' : l.confianza === 'baja' ? 'danger' : 'warn'}">Confianza ${esc(l.confianza || 'media')}</span></div></div></div>`).join('')}</div>` : '<p class="muted small">Sin aprendizajes nuevos.</p>'}
  </div>`;
}

/* ─────────────────────────────────────────────────────────────
   14. Bandeja y conversaciones
   ───────────────────────────────────────────────────────────── */

const INBOX_FILTERS = [
  ['todos', 'Todos'],
  ['responder', 'Para responder'],
  ['revisar', 'Por aprobar'],
  ['calientes', 'Calientes'],
  ['ventas', 'Ventas'],
  ['nuevos', 'Nuevos'],
];

function threadMatchesFilter(thread, filter) {
  if (filter === 'calientes') return ['interesado', 'negociando'].includes(thread.stage);
  if (filter === 'responder') return Boolean(thread.awaitingReply);
  if (filter === 'borradores') return num(thread.draftCount) > 0;
  if (filter === 'revisar') return num(thread.reviewCount) > 0 || num(thread.blockedCount) > 0;
  if (filter === 'ventas') return thread.stage === 'ganado';
  if (filter === 'nuevos') return thread.stage === 'nuevo';
  return true;
}

function filteredThreads() {
  const q = String(S.ui.inboxQuery || '').trim().toLowerCase();
  const base = arr(S.state?.threads).filter((thread) => {
    if (!threadMatchesFilter(thread, S.ui.inboxFilter)) return false;
    if (!q) return true;
    return [
      thread.contact?.company, thread.contact?.name, thread.contact?.email,
      thread.contact?.country, thread.contact?.city, thread.contact?.type,
      thread.nextStep, STAGES[thread.stage],
    ].some((value) => String(value || '').toLowerCase().includes(q));
  });
  // Lo que necesita tu decisión va primero: respuestas reales y borradores por aprobar.
  return base.sort((a, b) => {
    const ra = (a.awaitingReply ? 1000 : 0) + (num(a.reviewCount) > 0 ? 500 : 0) + num(a.score);
    const rb = (b.awaitingReply ? 1000 : 0) + (num(b.reviewCount) > 0 ? 500 : 0) + num(b.score);
    if (rb !== ra) return rb - ra;
    return new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0);
  });
}

function threadRowsHTML() {
  const threads = filteredThreads();
  if (!threads.length) {
    return `<div style="padding:30px 18px;text-align:center">
      <p class="small muted">${S.state?.counts?.threads ? 'Ninguna conversación coincide con ese filtro.' : 'Todavía no hay conversaciones.'}</p>
      ${S.state?.counts?.threads ? '<button class="btn btn-ghost btn-xs mt-3" type="button" data-action="inbox-reset">Ver todas</button>' : '<a class="btn btn-primary btn-xs mt-3" href="#/misiones/nueva">Lanzar una misión</a>'}
    </div>`;
  }
  return threads.map((thread) => {
    const active = S.thread?.thread?.id === thread.id;
    return `<a class="thread-row ${active ? 'active' : ''}" href="#/bandeja/${encodeURIComponent(thread.id)}" style="text-decoration:none">
      <div class="thread-row-top">
        <span class="avatar sm">${esc(initials(thread.contact?.company || thread.contact?.name || '?'))}</span>
        <div style="min-width:0;flex:1">
          <div class="thread-company"><span class="truncate" style="max-width:150px">${esc(thread.contact?.company || 'Contacto')}</span> ${stageBadge(thread.stage)}</div>
          <div class="thread-person truncate">${esc(thread.contact?.name || 'Sin nombre')}${thread.contact?.country ? ` · ${esc(thread.contact.country)}` : ''}</div>
        </div>
        <span class="thread-score" title="Prioridad">${esc(thread.score || 0)}</span>
      </div>
      <div class="thread-preview ${thread.lastMessage?.direction === 'in' ? 'in' : ''}">${esc(thread.awaitingReply ? 'Te escribió: ' : '')}${esc(thread.lastMessage?.body || thread.draftPreview?.body || thread.nextStep || 'Sin mensajes todavía.')}</div>
      <div class="thread-badges">
        ${demoBadge(thread.demo)}
        ${!thread.demo && !thread.suppressed ? '<span class="badge badge-ok">Comprador real</span>' : ''}
        ${thread.unverified ? '<span class="badge badge-warn">Sin verificar</span>' : ''}
        ${thread.suppressed ? '<span class="badge badge-danger">No contactar</span>' : ''}
        ${thread.draftCount ? `<span class="badge badge-amber">${thread.draftCount} listo${thread.draftCount === 1 ? '' : 's'}</span>` : ''}
        ${thread.reviewCount ? `<span class="badge badge-warn">${thread.reviewCount} por aprobar</span>` : ''}
        ${thread.blockedCount ? `<span class="badge badge-danger">${thread.blockedCount} bloqueado${thread.blockedCount === 1 ? '' : 's'}</span>` : ''}
        ${thread.awaitingReply ? '<span class="badge badge-ok">Te escribió</span>' : ''}
        ${thread.stage === 'ganado' ? '<span class="badge badge-ok">Venta ganada</span>' : ''}
        ${thread.nextFollowUp ? `<span class="badge badge-neutral">${icon('calendar')} ${esc(dateShort(thread.nextFollowUp))}</span>` : ''}
      </div>
    </a>`;
  }).join('');
}

function renderInbox(id) {
  const threads = arr(S.state?.threads);
  const totalDrafts = threads.reduce((acc, t) => acc + num(t.draftCount), 0);
  const fresh = id && S.thread?.thread?.id === id;
  const busy = id && S.threadLoading === id;
  const failed = id && S.threadError?.id === id;
  if (id && !fresh && !busy && !failed) loadThread(id);

  let detail;
  if (!id) detail = inboxEmptyHTML();
  else if (failed) detail = `<div class="inbox-empty"><span style="color:var(--danger)">${icon('alert')}</span><h3 style="font-family:var(--serif);font-size:22px;color:var(--ink);margin-top:8px">No pude abrir la conversación</h3><p style="max-width:40ch">${esc(S.threadError.message)}</p><div class="cluster mt-3"><button class="btn btn-primary btn-sm" type="button" data-action="reload-thread" data-id="${attr(id)}">${icon('refresh')} Reintentar</button><a class="btn btn-ghost btn-sm" href="#/bandeja">Volver a la bandeja</a></div></div>`;
  else if (!fresh) detail = threadSkeleton();
  else detail = threadDetailHTML(S.thread);

  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Bandeja</p>
      <h2 class="page-title">Personas, no leads.</h2>
      <p class="page-sub">Cada conversación es un comprador: real o de ejemplo. Mirá si te escribió en serio, qué quiere y qué tenés que aprobar. Nada se envía sin que lo confirmes.</p>
    </div>
    <div class="page-actions">
      ${S.state.flags?.email && S.state.settings?.email?.provider === 'gmail' ? `<button class="btn btn-ghost btn-sm" type="button" data-action="check-inbox">${icon('refresh')} Revisar correos</button>` : ''}
      <a class="btn btn-ghost btn-sm" href="/api/export/threads.csv" download>${icon('download')} Exportar CSV</a>
      ${pendingResendCount() ? `<button class="btn btn-accent btn-sm" type="button" data-action="prepare-resends">${icon('send')} Preparar reenvíos (${pendingResendCount()})</button>` : ''}
      ${threads.length ? `<button class="btn btn-danger btn-sm" type="button" data-action="delete-all-threads">${icon('trash')} Borrar todas (${threads.length})</button>` : ''}
      <a class="btn btn-primary btn-sm" href="#/misiones/nueva">${icon('plus')} Nueva misión</a>
    </div>
  </div>

  <div class="inbox">
    <aside class="inbox-list ${id ? 'hide-mobile' : ''}">
      <div class="inbox-head">
        <div class="between"><h2>Conversaciones</h2><span class="badge badge-neutral">${threads.length}</span></div>
        <p class="tiny muted" style="margin-top:2px">${threads.length} conversaciones · ${threads.filter((t) => t.awaitingReply).length} te escribieron · ${threads.reduce((a, t) => a + num(t.reviewCount), 0)} por aprobar · ${threads.filter((t) => t.stage === 'ganado').length} ventas</p>
        <div class="search-field" style="margin-top:10px">${icon('search')}<input class="input" id="inbox-search" type="search" value="${attr(S.ui.inboxQuery || '')}" placeholder="Buscar empresa, persona o país”¦" aria-label="Buscar conversaciones"></div>
        <div class="inbox-filters" id="inbox-filters">
          ${INBOX_FILTERS.map(([value, label]) => `<button class="chip ${S.ui.inboxFilter === value ? 'active' : ''}" type="button" data-action="inbox-filter" data-filter="${value}">${label}</button>`).join('')}
        </div>
      </div>
      <div class="inbox-scroll" id="thread-list">${threadRowsHTML()}</div>
    </aside>
    <section class="inbox-detail ${!id ? 'hide-mobile' : ''}" id="inbox-detail">${detail}</section>
  </div>`;
}

function inboxEmptyHTML() {
  return `<div class="inbox-empty">
    <span>${icon('inbox')}</span>
    <h3 style="font-family:var(--serif);font-size:24px;font-weight:560;color:var(--ink);margin-top:8px">Elegí una conversación</h3>
    <p style="max-width:42ch;margin-top:5px">Cuando una misión termina, cada comprador aparece acá con su borrador, su contexto y su próximo paso.</p>
    ${arr(S.state?.threads).length ? '<p class="tiny" style="margin-top:8px">También podés empezar por los que tienen borradores pendientes.</p>' : '<a class="btn btn-primary btn-sm mt-3" href="#/misiones/nueva">Lanzar la primera misión</a>'}
  </div>`;
}

function threadSkeleton() {
  return `<div class="inbox-empty"><span class="pulse">${icon('mail')}</span><p style="margin-top:8px">Abriendo la conversación”¦</p></div>`;
}

function threadDetailHTML(data) {
  const thread = data.thread;
  const contact = thread.contact || {};
  const product = data.product || arr(S.state.products).find((p) => p.id === thread.productId);
  const mission = data.mission && data.mission.id ? data.mission : null;
  const messages = [...arr(thread.messages)].sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0));
  const readyDrafts = arr(thread.drafts).filter((d) => d.status === 'listo');
  const reviewDrafts = arr(thread.drafts).filter((d) => d.status === 'revisar');
  const blockedDrafts = arr(thread.drafts).filter((d) => d.status === 'bloqueado');
  const validEmail = isEmail(contact.email);
  const suppressed = Boolean(thread.suppressed);
  return `<div class="thread-hero">
    <div class="thread-hero-top">
      <a class="icon-btn bordered" href="#/bandeja" aria-label="Volver a la bandeja" title="Volver">${icon('arrowLeft')}</a>
      <span class="avatar lg">${esc(initials(contact.company || contact.name || '?'))}</span>
      <div style="min-width:0;flex:1">
        <div class="thread-hero-name">${esc(contact.company || 'Contacto')} ${demoBadge(thread.demo)} ${!thread.demo && !suppressed ? '<span class="badge badge-ok">Comprador real</span>' : ''} ${thread.unverified ? '<span class="badge badge-warn">Sin verificar</span>' : ''} ${suppressed ? '<span class="badge badge-danger">No contactar</span>' : ''} ${thread.awaitingReply ? '<span class="badge badge-ok">Te escribió</span>' : ''}</div>
        <div class="thread-hero-sub">
          <span>${esc(contact.name || 'Sin nombre')}${contact.role ? ` · ${esc(contact.role)}` : ''}</span>
          ${contact.email ? `<a href="mailto:${attr(contact.email)}">${esc(contact.email)}</a>` : '<span style="color:var(--danger)">Sin email</span>'}
          ${contact.country || contact.city ? `<span>${esc([contact.city, contact.country].filter(Boolean).join(', '))}</span>` : ''}
          ${contact.type ? `<span>${esc(contact.type)}</span>` : ''}
        </div>
      </div>
      <div class="thread-hero-actions">
        <select class="select stage-select" id="thread-stage" data-thread-id="${attr(thread.id)}" aria-label="Etapa de la conversación">
          ${Object.entries(STAGES).map(([value, label]) => `<option value="${value}" ${thread.stage === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" type="button" data-action="edit-contact" data-id="${attr(thread.id)}">${icon('edit')} Contacto</button>
        ${!suppressed ? `<button class="btn btn-ghost btn-sm" type="button" data-action="new-quote" data-id="${attr(thread.id)}">${icon('dollar')} Cotizar</button>` : ''}
        <button class="btn btn-primary btn-sm" type="button" data-action="analyze-thread" data-id="${attr(thread.id)}">${icon('wand')} Analizar</button>
        <button class="icon-btn danger" type="button" data-action="delete-thread" data-id="${attr(thread.id)}" aria-label="Eliminar conversación" title="Eliminar conversación">${icon('trash')}</button>
      </div>
    </div>
    ${suppressed ? `<div class="artifact-callout danger mt-3"><b>Este contacto está en la lista de no contactar</b>${thread.optOut?.rule ? ` Detectado por: ${esc(thread.optOut.rule)}.` : ''} No se puede enviar ni descargar un correo. Si fue un error, quitá la supresión en Ajustes → No contactar; los borradores volverán a revisión.</div>` : ''}
    ${thread.unverified ? `<div class="artifact-callout warn mt-3"><b>Este prospecto no está verificado</b><p class="mt-2">${esc(thread.unverifiedReason || 'Se creó antes de que Lucian exigiera sitio web o email comprobables.')} Confirmá que la tienda existe y cuál es su canal antes de enviar cualquier mensaje.</p></div>` : ''}
    <div class="thread-facts">
      <span class="fact">${icon('target')} Prioridad <b>${esc(thread.score || 0)}</b></span>
      <span class="fact">${icon('mail')} ${readyDrafts.length} listo${readyDrafts.length === 1 ? '' : 's'}</span>
      ${reviewDrafts.length ? `<span class="fact">${icon('alert')} ${reviewDrafts.length} por aprobar</span>` : ''}
      ${blockedDrafts.length ? `<span class="fact">${icon('lock')} ${blockedDrafts.length} bloqueado${blockedDrafts.length === 1 ? '' : 's'}</span>` : ''}
      ${suppressed ? '<span class="fact">' + icon('shield') + ' No contactar</span>' : ''}
      ${thread.nextFollowUp ? `<span class="fact">${icon('calendar')} Seguimiento ${esc(dateTime(thread.nextFollowUp))}</span>` : ''}
      <span class="fact">${icon('clock')} ${esc(relTime(thread.lastActivityAt || thread.updatedAt))}</span>
      ${thread.lastAnalysis?.intencion ? `<span class="fact">${icon('wand')} Intención: <b>${esc(String(thread.lastAnalysis.intencion).replace(/_/g, ' '))}</b></span>` : ''}
      ${product ? `<span class="fact">${icon('box')} ${esc(product.name)}</span>` : ''}
      ${mission ? `<a class="fact" href="#/misiones/${encodeURIComponent(mission.id)}" style="text-decoration:none">${icon('spark')} ${esc(mission.name)}</a>` : ''}
      ${contact.website ? `<a class="fact" href="${attr(safeUrl(contact.website) || '#')}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">${icon('globe')} ${esc(truncate(contact.website.replace(/^https?:\/\//, ''), 32))}</a>` : ''}
      ${thread.verification?.webEstado === 'verificado' ? `<span class="fact" title="${attr(thread.verification.webTitulo || '')}">${icon('check')} Sitio verificado</span>` : ''}
      ${thread.verification?.webEstado === 'fuente_secundaria' ? `<span class="fact">${icon('alert')} Sin sitio propio verificado</span>` : ''}
      ${thread.verification?.emailEstado === 'publico' ? `<span class="fact">${icon('mail')} Email público</span>` : thread.verification?.emailEstado === 'verificado' ? `<span class="fact">${icon('check')} Email verificado</span>` : ''}
    </div>
  </div>

  <div class="thread-body">
    <div class="thread-side-grid">
      <div>
        <section>
          <div class="thread-section-head"><h3>Conversación</h3><span class="tiny muted">${messages.length} mensaje${messages.length === 1 ? '' : 's'}</span></div>
          ${messages.length ? `<div class="conversation">${messages.map((message) => messageBubbleHTML(message, thread)).join('')}</div>` : `<div class="soft"><p class="small muted">Todavía no hay mensajes. Abajo podés registrar lo que respondió el comprador o crear un borrador nuevo.</p></div>`}
        </section>

        ${arr(thread.quotes).length ? `<section class="thread-section">
          <div class="thread-section-head"><h3>Cotizaciones</h3><span class="tiny muted">${arr(thread.quotes).length} preparada${arr(thread.quotes).length === 1 ? '' : 's'}</span></div>
          ${quotesHTML(thread)}
        </section>` : ''}

        <section class="thread-section">
          <div class="thread-section-head">
            <h3>Borradores</h3>
            <div class="cluster">
              ${thread.suppressed ? '<span class="tiny muted">No se pueden crear borradores para un contacto suprimido.</span>' : `<button class="btn btn-ghost btn-xs" type="button" data-action="new-draft" data-id="${attr(thread.id)}">${icon('plus')} Nuevo borrador</button>`}
            </div>
          </div>
          ${threadDraftsHTML(thread)}
          ${!readyDrafts.length && !arr(thread.drafts).some((d) => d.status === 'enviado') ? '<p class="tiny muted mt-2">Un borrador no es un envío. Podés editarlo, copiarlo, descargarlo o marcarlo como enviado cuando lo hayas mandado vos.</p>' : ''}
        </section>

        <section class="thread-section">
          <div class="thread-section-head"><h3>Registrar respuesta del comprador</h3><span class="badge badge-info">Opcional</span></div>
          <form class="composer" id="inbound-form" data-thread-id="${attr(thread.id)}">
            <div class="field"><label for="inbound-subject">Asunto</label><input class="input" id="inbound-subject" name="subject" placeholder="Re: tu consulta" maxlength="300"></div>
            <div class="field"><label for="inbound-body">Lo que respondió</label><textarea class="textarea" id="inbound-body" name="body" rows="4" placeholder="Pegá el correo o el mensaje. Lucian lo analiza y prepara el siguiente paso." required></textarea></div>
            <div class="composer-foot">
              <label class="checkbox"><input type="checkbox" name="analyze" checked><span>Analizar con el equipo y preparar un borrador de respuesta</span></label>
              <button class="btn btn-primary btn-sm" type="submit">${icon('spark')} Registrar y analizar</button>
            </div>
          </form>
        </section>
      </div>

      <aside>
        ${threadAnalysisHTML(thread)}
        <div class="side-block">
          <h4>Próximo paso</h4>
          <p>${esc(thread.nextStep || 'Definí qué sigue para no dejar la conversación enfriarse.')}</p>
          ${thread.nextFollowUp ? `<p class="tiny muted mt-2">${icon('calendar')} ${esc(dateTime(thread.nextFollowUp))}</p>` : ''}
        </div>
        <div class="side-block">
          <h4>Notas de la conversación</h4>
          <form id="thread-notes-form" data-thread-id="${attr(thread.id)}">
            <div class="field"><textarea class="textarea notes-area" id="thread-notes" name="notes" rows="4" placeholder="Qué dijo, qué le importa, qué prometiste”¦">${esc(thread.notes || '')}</textarea></div>
            <div class="field mt-2"><label for="thread-next-step">Siguiente paso</label><input class="input" id="thread-next-step" name="nextStep" value="${attr(thread.nextStep || '')}" maxlength="500" placeholder="Ej.: mandar ficha y plazo"></div>
            <div class="field mt-2"><label for="thread-followup">Fecha de seguimiento</label><input class="input" id="thread-followup" name="nextFollowUp" type="datetime-local" value="${attr(dateTimeLocal(thread.nextFollowUp))}"></div>
            <div class="field mt-2"><label for="thread-score">Prioridad (0”“100)</label><input class="input" id="thread-score" name="score" type="number" min="0" max="100" value="${attr(thread.score || 0)}"></div>
            <button class="btn btn-ghost btn-sm btn-block mt-3" type="submit">${icon('check')} Guardar notas</button>
          </form>
        </div>
        ${thread.demo ? `<div class="side-block" style="border-color:#e2cbe0;background:#fbf4fa"><h4 style="color:#7c5474">Conversación de ejemplo</h4><p>Este contacto es simulado. Los emails terminan en example.com y no se pueden enviar con Resend.</p></div>` : ''}
      </aside>
    </div>
  </div>`;
}

function messageBubbleHTML(message, thread) {
  const out = message.direction === 'out';
  const who = out ? 'Vos' : (thread.contact?.name || thread.contact?.company || 'Comprador');
  return `<div class="msg ${out ? 'out' : 'in'}">
    <div class="msg-head"><span>${esc(who)}</span><span>·</span><span>${esc(CHANNEL_LABEL[message.channel] || message.channel || 'email')}</span></div>
    <div class="msg-bubble">${message.subject ? `<div class="msg-subject">${esc(message.subject)}</div>` : ''}${esc(message.body || '')}</div>
    ${message.deliveryNote ? `<div class="draft-note danger" style="margin-top:5px">${icon('alert')} <span>${esc(message.deliveryNote)}</span></div>` : ''}
    <div class="msg-time">${esc(dateTime(message.at))}${message.status === 'enviado_manual' ? ' · marcado como enviado' : message.status === 'recibido' ? ' · recibido' : ''}</div>
  </div>`;
}

function draftStatusBadge(draft) {
  const map = {
    listo: ['amber', 'Listo para enviar'],
    revisar: ['warn', 'Por aprobar'],
    bloqueado: ['danger', 'Bloqueado'],
    enviado: ['ok', 'Enviado'],
    descartado: ['neutral', 'Descartado'],
  };
  const [tone, label] = map[draft.status] || ['neutral', 'Borrador'];
  return `<span class="badge badge-${tone}">${esc(label)}</span>`;
}

function threadDraftsHTML(thread) {
  const drafts = [...arr(thread.drafts)].sort((a, b) => {
    const order = (d) => ({ listo: 0, revisar: 1, bloqueado: 2, enviado: 3, descartado: 4 }[d.status] ?? 1);
    return order(a) - order(b) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });
  const suppressed = Boolean(thread.suppressed);
  if (!drafts.length) return '<div class="soft"><p class="small muted">Sin borradores todavía. Podés crear uno desde cero o analizar una respuesta para que el equipo lo prepare.</p></div>';
  const editing = S.ui.threadDraftEdit;
  return drafts.map((draft) => {
    const sent = draft.status === 'enviado';
    const discarded = draft.status === 'descartado';
    const blocked = draft.status === 'bloqueado';
    const review = draft.status === 'revisar';
    const ready = draft.status === 'listo';
    const isEditing = editing === draft.id && !sent && !discarded && !blocked;
    const body = draft.body || '';
    return `<div class="draft-card ${sent || discarded ? 'sent' : ''} ${review ? 'review' : ''} ${blocked ? 'blocked' : ''}" data-draft-card="${attr(draft.id)}">
      <div class="draft-head">
        <div style="min-width:0;flex:1">
          <div class="draft-subject">${esc(draft.subject || '(sin asunto)')}</div>
          <div class="thread-badges" style="margin-top:5px">
            ${draftStatusBadge(draft)}
            ${suppressed ? '<span class="badge badge-danger">No contactar</span>' : ''}
            <span class="badge badge-neutral">${esc(CHANNEL_LABEL[draft.channel] || draft.channel || 'email')}</span>
            <span class="badge badge-neutral">${esc((draft.language || 'es').toUpperCase())}</span>
            ${draft.revisionApplied ? '<span class="badge badge-info">Revisión aplicada</span>' : ''}
            ${draft.complianceCorrections ? `<span class="badge badge-info">${num(draft.complianceCorrections)} corrección${num(draft.complianceCorrections) === 1 ? '' : 'es'} de cumplimiento</span>` : ''}
            ${draft.compliancePending ? `<span class="badge badge-warn">${num(draft.compliancePending)} pendiente${num(draft.compliancePending) === 1 ? '' : 's'}</span>` : ''}
            ${draft.source === 'ia' ? '<span class="badge badge-info">IA</span>' : draft.source === 'manual' ? '<span class="badge badge-neutral">Manual</span>' : ''}
            ${draft.demo ? demoBadge(true) : ''}
          </div>
        </div>
        ${sent ? `<span class="tiny muted nowrap">${esc(dateShort(draft.sentAt || draft.updatedAt || draft.createdAt))}</span>` : ''}
      </div>
      ${draft.reattemptOf ? `<div class="draft-note warn">${icon('send')} <span><b>Reenvío:</b> ${esc(draft.note || 'Correo que no se entregó. Revisá y enviá por tu correo.')}</span></div>` : ''}
      ${review && draft.reviewNote ? `<div class="draft-note warn">${icon('alert')} <span>${esc(draft.reviewNote)}</span></div>` : ''}
      ${blocked ? `<div class="draft-note danger">${icon('lock')} <span>${esc(draft.blockedReason || 'Bloqueado por cumplimiento o red team. No se puede enviar.')}</span></div>` : ''}
      ${suppressed ? '<div class="draft-note danger">' + icon('shield') + ' <span>Este contacto pidió no recibir más mensajes. Quitá la supresión en Ajustes para habilitarlo.</span></div>' : ''}
      ${isEditing
        ? `<div class="draft-edit">
            <div class="field"><label>Asunto</label><input class="input" data-draft-subject value="${attr(draft.subject || '')}" maxlength="300"></div>
            <div class="field"><label>Cuerpo</label><textarea class="textarea" data-draft-body rows="9">${esc(body)}</textarea></div>
            <div class="form-grid">
              <div class="field"><label>Canal</label><select class="select" data-draft-channel>${['email', 'formulario', 'whatsapp', 'otro'].map((c) => `<option value="${c}" ${draft.channel === c ? 'selected' : ''}>${esc(CHANNEL_LABEL[c] || c)}</option>`).join('')}</select></div>
              <div class="field"><label>Idioma</label><input class="input" data-draft-language value="${attr(draft.language || 'es')}" maxlength="8"></div>
            </div>
            <div class="draft-actions">
              <button class="btn btn-primary btn-xs" type="button" data-action="save-draft" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('check')} Guardar borrador</button>
              <button class="btn btn-ghost btn-xs" type="button" data-action="cancel-draft-edit">Cancelar</button>
            </div>
          </div>`
        : `<div class="draft-body">${esc(body || '(vacío)')}</div>
          <div class="draft-actions">
            ${ready && !suppressed ? `<button class="btn btn-primary btn-xs" type="button" data-action="send-draft" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('send')} Enviar</button>` : ''}
            ${review && !suppressed ? `<button class="btn btn-accent btn-xs" type="button" data-action="approve-draft" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('check')} Aprobar</button>` : ''}
            ${review || ready ? `<button class="btn btn-ghost btn-xs" type="button" data-action="edit-draft" data-draft-id="${attr(draft.id)}">${icon('edit')} Editar</button>` : ''}
            ${!blocked ? copyButton(`${draft.subject ? `Asunto: ${draft.subject}\n\n` : ''}${body}`, 'Copiar') : ''}
            ${ready && !suppressed && isEmail(thread.contact?.email) ? `<button class="btn btn-ghost btn-xs" type="button" data-action="download-eml" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('download')} .eml</button>` : ''}
            ${!sent && !discarded ? `<button class="btn btn-ghost btn-xs" type="button" data-action="discard-draft" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">Descartar</button>` : ''}
            ${!sent ? `<button class="btn btn-ghost btn-xs" type="button" data-action="delete-draft" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}" title="Borrar borrador">${icon('trash')}</button>` : ''}
            ${sent ? `<span class="tiny muted">Enviado por ${esc(CHANNEL_LABEL[draft.sentChannel] || draft.sentChannel || 'manual')} · ${esc(dateTime(draft.sentAt))}</span>` : ''}
          </div>`}
    </div>`;
  }).join('');
}

function threadAnalysisHTML(thread) {
  const analysis = thread.lastAnalysis;
  if (!analysis) {
    return `<div class="side-block">
      <h4>Lectura del equipo</h4>
      <p>Cuando el comprador responda, registralo acá. El analista detecta la intención, actualiza la etapa y deja un borrador de respuesta.</p>
      <button class="btn btn-ghost btn-xs btn-block mt-3" type="button" data-action="analyze-thread" data-id="${attr(thread.id)}">${icon('wand')} Analizar ahora</button>
    </div>`;
  }
  return `<div class="analysis">
    <h4>Lectura del analista</h4>
    <div class="analysis-grid">
      <div class="analysis-item"><span>Intención</span><b>${esc(String(analysis.intencion || 'sin dato').replace(/_/g, ' '))}</b></div>
      <div class="analysis-item"><span>Sentimiento</span><b>${esc(analysis.sentimiento || 'sin dato')}</b></div>
      <div class="analysis-item"><span>Prioridad</span><b>${esc(analysis.score ?? thread.score ?? '””')}</b></div>
      <div class="analysis-item"><span>Etapa sugerida</span><b>${esc(STAGES[analysis.etapa] || analysis.etapa || '””')}</b></div>
    </div>
    ${arr(analysis.senales).length ? `<ul>${analysis.senales.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    ${analysis.siguiente_paso ? `<p class="tiny" style="margin-top:8px"><b>Siguiente paso:</b> ${esc(analysis.siguiente_paso)}</p>` : ''}
    ${analysis.nota ? `<p class="tiny muted" style="margin-top:6px">${esc(analysis.nota)}</p>` : ''}
    ${analysis.demo ? '<p class="tiny muted" style="margin-top:6px">Análisis simulado del modo demo.</p>' : ''}
  </div>`;
}

function dateTimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
}

function isDemoEmail(value) {
  return /@example\.(com|org|net)$/i.test(String(value || '').trim());
}

async function loadThread(id, { force = false } = {}) {
  if (!force && S.thread?.thread?.id === id) return;
  if (S.threadLoading === id) return;
  S.threadLoading = id;
  S.threadError = null;
  try {
    const data = await api(`/api/threads/${encodeURIComponent(id)}`, { silent: true });
    S.thread = data;
    S.threadError = null;
    if (S.route.view === 'bandeja' && S.route.id === id) {
      updateShell();
      render();
    }
  } catch (error) {
    S.threadError = { id, message: error.message || 'Error inesperado.' };
    if (S.route.view === 'bandeja' && S.route.id === id) render();
  } finally {
    if (S.threadLoading === id) S.threadLoading = null;
  }
}

async function refreshThread() {
  const id = S.thread?.thread?.id;
  if (!id) return;
  S.threadLoading = null;
  await loadThread(id, { force: true });
}

function repaintThread() {
  if (S.route.view !== 'bandeja' || !S.route.id) return;
  const body = $('#inbox-detail .thread-body');
  const y = body?.scrollTop || 0;
  render();
  requestAnimationFrame(() => {
    const next = $('#inbox-detail .thread-body');
    if (next) next.scrollTop = y;
  });
}

function applyInboxList() {
  const list = $('#thread-list');
  if (!list) return;
  list.innerHTML = threadRowsHTML();
}

async function updateThreadStage(threadId, stage) {
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}`, { method: 'PATCH', body: { stage } });
    await loadState({ silent: true, render: false });
    if (S.thread?.thread?.id === threadId) S.thread.thread.stage = stage;
    toast(`Etapa actualizada: ${STAGES[stage] || stage}.`);
    applyInboxList();
    updateShell();
  } catch (error) {
    toast(error.message, 'error');
    repaintThread();
  }
}

async function saveThreadDetails(form) {
  const id = form.dataset.threadId;
  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    notes: String(data.notes || ''),
    nextStep: String(data.nextStep || ''),
    score: num(data.score, 0),
    nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp).toISOString() : null,
  };
  try {
    await api(`/api/threads/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
    await loadState({ silent: true, render: false });
    await refreshThread();
    toast('Notas y próximo paso guardados.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function addInboundMessage(form) {
  const id = form.dataset.threadId;
  const body = String(form.querySelector('#inbound-body')?.value || '').trim();
  if (!body) { toast('Pegá la respuesta del comprador.', 'error'); return; }
  const subject = String(form.querySelector('#inbound-subject')?.value || '').trim();
  const analyze = Boolean(form.querySelector('[name="analyze"]')?.checked);
  const button = form.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Analizando”¦`; }
  try {
    const result = await api(`/api/threads/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: { direction: 'in', channel: 'email', subject, body, analyze },
    });
    if (S.thread?.thread?.id === id) S.thread.thread = result.thread;
    await loadState({ silent: true, render: false });
    await refreshThread();
    if (result.optOut) toast('El contacto pidió no recibir más mensajes. Lo agregué a la lista de no contactar.', 'info');
    else if (result.analysisError) toast(`Respuesta guardada. No pude analizarla: ${result.analysisError}`, 'info');
    else if (result.analysis) toast(`Respuesta registrada. Intención: ${String(result.analysis.intencion || 'revisar').replace(/_/g, ' ')}.`);
    else toast('Respuesta registrada.');
  } catch (error) {
    toast(error.message, 'error');
    if (button) { button.disabled = false; button.innerHTML = `${icon('spark')} Registrar y analizar`; }
  }
}

async function analyzeCurrentThread(button) {
  const id = S.thread?.thread?.id;
  if (!id) return;
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Leyendo”¦`; }
  try {
    const result = await api(`/api/threads/${encodeURIComponent(id)}/analyze`, { method: 'POST' });
    S.thread.thread = result.thread;
    await loadState({ silent: true, render: false });
    repaintThread();
    toast(result.analysis?.demo ? 'Análisis de ejemplo listo.' : 'Respuesta analizada y etapa actualizada.');
  } catch (error) {
    toast(error.message, 'error');
    repaintThread();
  }
}

function quoteStatusBadge(status) {
  const map = {
    borrador: ['neutral', 'Borrador'],
    enviada: ['info', 'Enviada'],
    aceptada: ['ok', 'Aceptada'],
    rechazada: ['danger', 'Rechazada'],
  };
  const [tone, label] = map[status] || ['neutral', 'Cotización'];
  return `<span class="badge badge-${tone}">${esc(label)}</span>`;
}

function quotesHTML(thread) {
  const quotes = arr(thread.quotes);
  if (!quotes.length) return '';
  return quotes.map((quote) => {
    const quantity = num(quote.quantity, 1);
    const total = num(quote.total, 0);
    const accepted = quote.status === 'aceptada';
    const rejected = quote.status === 'rechazada';
    return `<div class="draft-card ${accepted ? 'sent' : ''}">
      <div class="draft-head">
        <div style="min-width:0;flex:1">
          <div class="draft-subject">${esc(quote.number || 'Cotización')} · ${esc(quote.productName || 'Producto')}</div>
          <div class="thread-badges" style="margin-top:5px">
            ${quoteStatusBadge(quote.status)}
            <span class="badge badge-neutral">${quantity} × ${esc(money(quote.unitPrice, quote.currency))}</span>
            <span class="badge badge-neutral">Total ${esc(money(total, quote.currency))}</span>
            ${quote.validUntil ? `<span class="badge badge-neutral">Válida hasta ${esc(dateShort(quote.validUntil))}</span>` : ''}
          </div>
        </div>
        <span class="tiny muted nowrap">${esc(dateShort(quote.createdAt))}</span>
      </div>
      <div class="draft-body">
        ${quote.shipping > 0 ? `<div>Envío: ${esc(money(quote.shipping, quote.currency))}</div>` : ''}
        ${quote.discount > 0 ? `<div>Descuento: −${esc(money(quote.discount, quote.currency))}</div>` : ''}
        ${quote.taxAmount > 0 ? `<div>Impuestos (${num(quote.taxRate)}%): ${esc(money(quote.taxAmount, quote.currency))}</div>` : ''}
        ${quote.notes ? `<div class="mt-2">${esc(quote.notes)}</div>` : ''}
        ${quote.paymentLink ? `<div class="mt-2"><a href="${attr(safeUrl(quote.paymentLink) || '#')}" target="_blank" rel="noopener noreferrer">${esc(truncate(quote.paymentLink, 60))}</a></div>` : '<div class="tiny muted mt-2">Sin link de pago: la confirmación se pide por correo.</div>'}
      </div>
      <div class="draft-actions">
        ${!accepted ? `<button class="btn btn-primary btn-xs" type="button" data-action="quote-status" data-id="${attr(thread.id)}" data-quote-id="${attr(quote.id)}" data-status="aceptada">${icon('check')} Aceptada</button>` : ''}
        ${!rejected && !accepted ? `<button class="btn btn-ghost btn-xs" type="button" data-action="quote-status" data-id="${attr(thread.id)}" data-quote-id="${attr(quote.id)}" data-status="rechazada">Rechazada</button>` : ''}
        ${accepted ? `<span class="tiny muted">Cotización aceptada, no significa cobrada.</span><span class="tiny muted">Cobrado manualmente: ${esc(money(arr(quote.payments).reduce((a,p)=>a+num(p.amount,0),0), quote.currency))} / ${esc(money(total, quote.currency))}</span><button class="btn btn-primary btn-xs" type="button" data-action="record-payment" data-id="${attr(thread.id)}" data-quote-id="${attr(quote.id)}">Registrar cobro</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function quotePreviewHTML(data, currency) {
  const items = Array.isArray(data.items) ? data.items : [];
  const singleQty = Math.max(1, Math.floor(num(data.quantity, 1)));
  const singleUnit = Math.max(0, num(data.unitPrice, 0));
  const lines = items.length
    ? items.map((it) => {
        const qty = Math.max(1, Math.floor(num(it.quantity, 1)));
        const unit = Math.max(0, num(it.unitPrice, 0));
        const gross = qty * unit;
        const disc = Math.min(gross, Math.max(0, num(it.discount, 0)));
        return { qty, unit, gross, disc, total: gross - disc, name: it.productName || 'Pieza' };
      })
    : [{ qty: singleQty, unit: singleUnit, gross: singleQty * singleUnit, disc: Math.min(singleQty * singleUnit, Math.max(0, num(data.discount, 0))), total: 0, name: 'Pieza' }];
  if (!items.length) lines[0].total = lines[0].gross - lines[0].disc;
  const subtotal = lines.reduce((a, l) => a + l.total, 0);
  const discount = lines.reduce((a, l) => a + l.disc, 0);
  const shipping = Math.max(0, num(data.shipping, 0));
  const taxRate = Math.max(0, Math.min(100, num(data.taxRate, 0)));
  const tax = (subtotal + shipping) * taxRate / 100;
  const total = subtotal + shipping + tax;
  return `${lines.map((l) => `<div class="between"><span>${l.qty} × ${esc(l.name)}</span><b>${esc(money(l.total, currency))}</b></div>`).join('')}
    ${discount > 0 ? `<div class="between"><span>Descuentos</span><b>−${esc(money(discount, currency))}</b></div>` : ''}
    ${shipping > 0 ? `<div class="between"><span>Envío</span><b>${esc(money(shipping, currency))}</b></div>` : ''}
    ${tax > 0 ? `<div class="between"><span>Impuestos (${taxRate}%)</span><b>${esc(money(tax, currency))}</b></div>` : ''}
    <div class="between" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><b>Total</b><b>${esc(money(total, currency))}</b></div>`;
}

function quoteLineHTML(product, index, currency) {
  const p = product || {};
  const cur = p.currency || currency;
  const colores = String(p.colors || p.Colores || '').trim();
  return `<div class="quote-line" data-quote-line="${index}" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
    <div class="between" style="margin-bottom:8px">
      <div style="min-width:0;flex:1">
        <b style="font-size:13px">${esc(p.name || 'Lámpara')}</b>
        ${p.code ? `<span class="tiny muted" style="margin-left:6px">${esc(p.code)}</span>` : ''}
        ${num(p.capacityPerWeek) > 0 ? `<span class="tiny muted" style="margin-left:6px">${num(p.capacityPerWeek)}/sem</span>` : ''}
      </div>
      <button class="btn btn-ghost btn-xs" type="button" data-action="quote-remove-line" data-index="${index}" ${index === 0 ? 'disabled title="Dejá al menos una lámpara"' : ''}>${icon('trash')} Quitar</button>
    </div>
    <div class="form-grid">
      <div class="field"><label>Cantidad</label><input class="input" name="qty" type="number" min="1" step="1" value="1" data-qfield="quantity"></div>
      <div class="field"><label>Precio unitario (${esc(cur)})</label><input class="input" name="unit" type="number" min="0" step="0.01" value="${attr(num(p.price, 0))}" data-qfield="unitPrice"></div>
      <div class="field"><label>Descuento (${esc(cur)})</label><input class="input" name="disc" type="number" min="0" step="0.01" value="0" data-qfield="discount"></div>
      <div class="field"><label>Subtotal</label><div class="input line-subtotal" style="display:flex;align-items:center">—</div></div>
      <div class="field"><label>Color / acabado</label><input class="input" name="color" value="${attr(colores)}" placeholder="Ej.: hueso, terracota"></div>
      <div class="field"><label>Plazo (días)</label><input class="input" name="lead" type="number" min="0" step="1" value="${attr(num(p.leadTimeDays, 0))}" placeholder="Según ficha"></div>
      <div class="field full"><label>Nota de esta lámpara</label><input class="input" name="lineNote" value="" placeholder="Ej.: incluye difusor opalino, medidas especiales…"></div>
    </div>
  </div>`;
}

function openCatalogQuoteModal() {
  const products = arr(S.state.products).filter((p) => p.status !== 'archivado');
  if (!products.length) { toast('No hay lámparas en el catálogo.', 'error'); return; }
  openModal({
    title: 'Cotizar todo el catálogo',
    subtitle: 'Armá una propuesta con todas tus lámparas para enviar por correo o WhatsApp.',
    size: 'modal-lg',
    body: `<div class="artifact-callout info"><b>Cómo funciona:</b> elegís el destinatario y se arma una cotización con las ${products.length} lámparas (o las que elijas). Después la revisás y la mandás desde tu correo.</div>
      <div class="form-section">
        <p class="form-section-title">1. ¿A quién va la propuesta?</p>
        <div class="form-grid">
          <div class="field"><label for="cat-email">Email del comprador (opcional)</label><input class="input" id="cat-email" type="email" placeholder="compras@tienda.com"></div>
          <div class="field"><label for="cat-name">Nombre / empresa</label><input class="input" id="cat-name" value="Cliente potencial" placeholder="Nombre de la tienda"></div>
          <div class="field"><label for="cat-country">País</label><select class="select" id="cat-country">${['Argentina','Chile','Uruguay','México','Colombia','España','Estados Unidos','Brasil','Otro'].map((c) => `<option value="${attr(c)}" ${c === 'Argentina' ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        </div>
      </div>
      <div class="form-section">
        <p class="form-section-title">2. Elegí las lámparas</p>
        <div class="cluster">
          <label class="checkbox"><input type="checkbox" id="cat-all" checked><span>Todas las lámparas (${products.length})</span></label>
        </div>
        <div class="product-pick-list mt-2" id="cat-products">${products.map((p) => `<label class="checkbox" style="padding:4px 0"><input type="checkbox" class="cat-product" data-id="${attr(p.id)}" checked data-name="${attr(p.name)}"><span>${esc(p.name)} · ${esc(money(p.price, p.currency))}</span></label>`).join('')}</div>
      </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button>
      <button class="btn btn-accent" type="button" data-action="quote-catalog-build">${icon('dollar')} Preparar cotización</button>`,
    onMount: (root) => {
      const all = root.querySelector('#cat-all');
      if (all) all.addEventListener('change', () => {
        root.querySelectorAll('.cat-product').forEach((c) => { c.checked = all.checked; });
      });
    },
  });
}

async function buildCatalogQuote() {
  const picks = [...document.querySelectorAll('.cat-product:checked')];
  if (!picks.length) { toast('Elegí al menos una lámpara.', 'error'); return; }
  const email = String($('#cat-email')?.value || '').trim();
  const name = String($('#cat-name')?.value || 'Cliente potencial').trim();
  const country = String($('#cat-country')?.value || 'Argentina').trim();
  const virtualThread = {
    id: '__catalogo__',
    contact: { company: name, name, email: email || 'cliente@example.com', country },
    productId: picks[0].dataset.id,
    drafts: [],
    messages: [],
    stage: 'nuevo',
  };
  S.catalogQuote = { picks: picks.map((p) => p.dataset.id), email, name, country };
  closeModal(true);
  openQuoteModal(virtualThread);
  // una vez abierto, cargar todas las elegidas
  const lines = $('#quote-lines');
  const products = arr(S.state.products);
  if (lines) {
    lines.innerHTML = '';
    picks.forEach((p, i) => {
      const prod = products.find((x) => x.id === p.dataset.id);
      if (prod) lines.insertAdjacentHTML('beforeend', quoteLineHTML(prod, i, prod.currency || S.state.brand?.currency || 'USD'));
    });
  }
  refreshQuotePreview();
  const footer = $('.modal-foot');
  if (footer) {
    footer.innerHTML = `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button>
      <button class="btn btn-accent" type="button" data-action="save-catalog-quote">${icon('dollar')} Preparar cotización</button>`;
  }
}

async function saveCatalogQuote() {
  const data = readQuoteForm();
  if (!data || !data.lines.length) { toast('No hay lámparas en la cotización.', 'error'); return; }
  const info = S.catalogQuote || {};
  let threadId = null;
  try {
    // Crear un hilo real para guardar la cotización
    const body = {
      contact: { company: info.name || 'Cliente potencial', name: info.name || 'Cliente potencial', email: info.email || 'cliente@example.com', country: info.country || 'Argentina' },
      productId: data.lines[0].productId,
      stage: 'negociando',
      notes: 'Cotización de catálogo completo generada desde Productos.',
    };
    const created = await api('/api/threads', { method: 'POST', body });
    threadId = created.thread?.id || created.id;
  } catch (error) {
    toast(`No se pudo crear el hilo: ${error.message}`, 'error');
    return;
  }
  if (!threadId) { toast('No se pudo guardar la cotización.', 'error'); return; }
  const button = $('[data-action="save-catalog-quote"]');
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Preparando…`; }
  try {
    const result = await api(`/api/threads/${encodeURIComponent(threadId)}/quotes`, {
      method: 'POST',
      body: {
        productId: data.lines[0].productId,
        items: data.lines,
        shipping: data.shipping,
        taxRate: data.taxRate,
        validDays: data.validDays,
        currency: data.currency,
        paymentLink: data.paymentLink,
        payTerms: data.payTerms, volumeNote: data.volumeNote, shipNote: data.shipNote,
        notes: data.notes,
        approve: data.approve,
      },
    });
    closeModal();
    S.catalogQuote = null;
    await loadState({ silent: true, render: false });
    navigate(`#/bandeja/${encodeURIComponent(threadId)}`);
    toast(`Cotización ${result.quote?.number || ''} lista con ${data.lines.length} lámparas. Revisá el borrador y enviálo.`);
  } catch (error) {
    toast(error.message, 'error');
    if (button) { button.disabled = false; button.innerHTML = `${icon('dollar')} Preparar cotización`; }
  }
}

function openQuoteModal(thread) {
  const first = arr(S.state.products).find((item) => item.id === thread.productId) || arr(S.state.products)[0] || {};
  const settings = S.state.settings || {};
  const brand = S.state.brand || {};
  const currency = first.currency || brand.currency || 'USD';
  const paymentLink = first.paymentLink || settings.sales?.paymentLink || '';
  const validDays = num(settings.sales?.quoteValidityDays, 15) || 15;
  const products = arr(S.state.products).filter((p) => p.status !== 'archivado');
  const leadTime = num(first.leadTimeDays, 0);
  const capacity = num(first.capacityPerWeek, 0);
  const body = `<form id="quote-form" data-thread-id="${attr(thread.id)}">
    <div class="form-section">
      <p class="form-section-title">Lámparas de la cotización</p>
      <p class="form-section-sub">Agregá una o varias. El precio, la cantidad y el descuento se calculan por línea. El envío y los impuestos son globales.${capacity > 0 ? ` Capacidad: ${capacity} por semana.` : ''}</p>
      <div id="quote-lines">${quoteLineHTML(first, 0, currency)}</div>
      <div class="cluster mt-2">
        <button class="btn btn-ghost btn-sm" type="button" data-action="quote-add-line">${icon('plus')} Agregar otra lámpara</button>
        ${products.length > 1 ? `<button class="btn btn-accent btn-sm" type="button" data-action="quote-add-all">${icon('layers')} Agregar TODAS las lámparas (${products.length})</button>` : ''}
      </div>
      ${products.length > 1 ? `<div class="field mt-3"><label>Agregar rápido desde el catálogo</label><select class="select" id="quote-product-pick"><option value="">Elegir lámpara…</option>${products.map((p) => `<option value="${attr(p.id)}">${esc(p.name)} · ${esc(money(p.price, p.currency || currency))}</option>`).join('')}</select></div>` : ''}
    </div>
    <div class="form-section">
      <p class="form-section-title">Condiciones generales</p>
      <div class="form-grid">
        <div class="field"><label for="q-shipping">Envío (${esc(currency)})</label><input class="input" name="shipping" type="number" min="0" step="0.01" value="0"></div>
        <div class="field"><label for="q-tax">Impuestos (%)</label><input class="input" name="taxRate" type="number" min="0" max="100" step="0.1" value="0"></div>
        <div class="field"><label for="q-valid">Validez (días)</label><input class="input" name="validDays" type="number" min="1" max="120" step="1" value="${attr(validDays)}"></div>
        <div class="field"><label for="q-currency">Moneda</label><input class="input" name="currency" value="${attr(currency)}" maxlength="6"></div>
        <div class="field full"><label for="q-payment">Link de pago</label><input class="input" name="paymentLink" type="url" value="${attr(paymentLink)}" placeholder="https://…"><p class="field-hint">Si lo dejás vacío, el correo pide confirmación y el link se envía después.</p></div>
        <div class="field"><label for="q-payterms">Condiciones de pago</label><input class="input" name="payTerms" value="" placeholder="Ej.: 50% seña, 50% contra entrega"></div>
        <div class="field"><label for="q-volume">Descuento por volumen</label><input class="input" name="volumeNote" value="" placeholder="Ej.: 10% desde 6 unidades"></div>
        <div class="field full"><label for="q-shipnote">Detalle de envío</label><input class="input" name="shipNote" value="" placeholder="Ej.: flete a cargo del comprador, despacho en 3 días"></div>
        <div class="field full"><label for="q-notes">Nota para el comprador</label><textarea class="textarea" name="notes" rows="3" placeholder="Condiciones, color, embalaje, fecha de entrega…"></textarea></div>
      </div>
    </div>
    <div class="soft" id="quote-preview" style="margin-top:12px">${quotePreviewHTML({ items: [{ productName: first.name, quantity: 1, unitPrice: num(first.price, 0), discount: 0 }] }, currency)}</div>
    <label class="checkbox mt-3"><input type="checkbox" name="approve" value="1"><span>Dejar el borrador listo para enviar (revisé precios, envío y plazo).</span></label>
  </form>`;
  openModal({
    title: 'Preparar cotización',
    subtitle: 'Una o varias lámparas, un solo correo claro con precio y link de pago.',
    size: 'modal-lg',
    body,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" type="button" data-action="save-quote" data-id="${attr(thread.id)}">${icon('dollar')} Preparar cotización</button>`,
    onMount: (root) => {
      refreshQuotePreview();
      root.addEventListener('input', (e) => {
        if (e.target.closest('#quote-form')) refreshQuotePreview();
      });
      const pick = root.querySelector('#quote-product-pick');
      if (pick) pick.addEventListener('change', () => {
        const p = arr(S.state.products).find((x) => x.id === pick.value);
        if (!p) return;
        const lines = root.querySelector('#quote-lines');
        const idx = lines.querySelectorAll('[data-quote-line]').length;
        lines.insertAdjacentHTML('beforeend', quoteLineHTML(p, idx, p.currency || currency));
        pick.value = '';
        refreshQuotePreview();
      });
    },
  });
}

function readQuoteForm() {
  const form = $('#quote-form');
  if (!form) return null;
  const lines = [...form.querySelectorAll('[data-quote-line]')].map((el) => ({
    productId: el.querySelector('[name="productId"]')?.value || '',
    quantity: num(el.querySelector('[name="qty"]')?.value, 1),
    unitPrice: num(el.querySelector('[name="unit"]')?.value, 0),
    discount: num(el.querySelector('[name="disc"]')?.value, 0),
    color: String(el.querySelector('[name="color"]')?.value || '').trim(),
    leadTimeDays: num(el.querySelector('[name="lead"]')?.value, 0),
    lineNote: String(el.querySelector('[name="lineNote"]')?.value || '').trim(),
    productName: el.querySelector('b')?.textContent || 'Lámpara',
  }));
  return {
    lines,
    shipping: num(form.querySelector('[name="shipping"]')?.value, 0),
    taxRate: num(form.querySelector('[name="taxRate"]')?.value, 0),
    validDays: num(form.querySelector('[name="validDays"]')?.value, 15),
    currency: String(form.querySelector('[name="currency"]')?.value || 'USD').trim().toUpperCase().slice(0, 6),
    paymentLink: String(form.querySelector('[name="paymentLink"]')?.value || '').trim(),
    payTerms: String(form.querySelector('[name="payTerms"]')?.value || '').trim(),
    volumeNote: String(form.querySelector('[name="volumeNote"]')?.value || '').trim(),
    shipNote: String(form.querySelector('[name="shipNote"]')?.value || '').trim(),
    notes: String(form.querySelector('[name="notes"]')?.value || ''),
    approve: Boolean(form.querySelector('[name="approve"]')?.checked),
  };
}

function refreshQuotePreview() {
  const data = readQuoteForm();
  const preview = $('#quote-preview');
  if (!data || !preview) return;
  const items = data.lines.map((l) => ({ ...l, productName: l.productName }));
  preview.innerHTML = quotePreviewHTML({ items, shipping: data.shipping, taxRate: data.taxRate }, data.currency);
  data.lines.forEach((l, i) => {
    const el = $(`[data-quote-line="${i}"] .line-subtotal`);
    if (el) el.textContent = money(l.quantity * l.unitPrice - l.discount, data.currency);
  });
}

async function saveQuote(threadId) {
  const data = readQuoteForm();
  if (!data) return;
  if (!data.lines.length || data.lines.some((l) => !(l.unitPrice > 0))) {
    toast('Revisá los precios: todos deben ser mayores a cero.', 'error'); return;
  }
  const button = $('[data-action="save-quote"]');
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Preparando…`; }
  try {
    const result = await api(`/api/threads/${encodeURIComponent(threadId)}/quotes`, {
      method: 'POST',
      body: {
        productId: data.lines[0].productId,
        items: data.lines,
        shipping: data.shipping,
        taxRate: data.taxRate,
        validDays: data.validDays,
        currency: data.currency,
        paymentLink: data.paymentLink,
        payTerms: data.payTerms,
        volumeNote: data.volumeNote,
        shipNote: data.shipNote,
        notes: data.notes,
        approve: data.approve,
      },
    });
    closeModal();
    await loadState({ silent: true, render: false });
    if (S.thread?.thread?.id === threadId) await loadThread(threadId, { force: true });
    render();
    toast(`Cotización ${result.quote?.number || ''} preparada con ${data.lines.length} lámpara${data.lines.length === 1 ? '' : 's'}.`);
  } catch (error) {
    toast(error.message, 'error');
    if (button) { button.disabled = false; button.innerHTML = `${icon('dollar')} Preparar cotización`; }
  }
}


async function setQuoteStatusUI(threadId, quoteId, status) {
  try {
    const confirmed = await confirmAction({ title: 'Cambiar estado de cotización', message: status === 'aceptada' ? '¿Confirmás que el cliente aceptó? Esto NO confirma un pago.' : '¿Confirmás que la rechazó?', confirmLabel: 'Actualizar cotización' });
    if (!confirmed) return;
    await api(`/api/threads/${encodeURIComponent(threadId)}/quotes/${encodeURIComponent(quoteId)}`, { method: 'PATCH', body: { status } });
    await loadState({ silent: true, render: false });
    await refreshThread();
    toast(status === 'aceptada' ? 'Cotización aceptada. Registrá un cobro cuando efectivamente ingrese.' : 'Cotización rechazada.');
  } catch (error) { toast(error.message, 'error'); }
}

function openPaymentModal(threadId, quoteId) {
  const quote = arr(S.thread?.thread?.quotes).find((item) => item.id === quoteId);
  if (!quote || quote.status !== 'aceptada') { toast('Primero se debe aceptar la cotización.', 'error'); return; }
  const received = arr(quote.payments).reduce((sum, item) => sum + num(item.amount, 0), 0);
  const remaining = Math.max(0, Math.round((num(quote.total) - received) * 100) / 100);
  if (!remaining) { toast('La cotización ya figura cobrada por completo.', 'info'); return; }
  openModal({
    title: 'Registrar cobro recibido',
    subtitle: 'Registro manual. No consulta Mercado Pago ni el banco: comprobá la acreditación antes de confirmar.',
    body: `<form id="payment-form" class="form-grid">
      <div class="field"><label>Importe recibido (${esc(quote.currency || 'USD')})</label><input class="input" type="number" name="amount" step="0.01" min="0.01" max="${attr(String(remaining))}" value="${attr(String(remaining))}" required></div>
      <div class="field"><label>Medio de cobro</label><select class="select" name="method"><option value="transferencia">Transferencia</option><option value="mercadopago">Mercado Pago</option><option value="efectivo">Efectivo</option><option value="otro">Otro</option></select></div>
      <div class="field full"><label>Número de operación o referencia</label><input class="input" name="reference" maxlength="120" placeholder="ID de operación / número de comprobante" required></div>
      <div class="field full"><label><input type="checkbox" name="confirm"> Confirmo que comprobé personalmente que este importe ingresó. Entiendo que Lucian no lo concilia automáticamente.</label></div>
    </form>`,
    footer: `<button class="btn btn-ghost" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-payment" data-id="${attr(threadId)}" data-quote-id="${attr(quoteId)}">Guardar cobro manual</button>`,
  });
}

async function savePaymentUI(threadId, quoteId) {
  const form = $('#payment-form');
  if (!form) return;
  const values = new FormData(form);
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}/quotes/${encodeURIComponent(quoteId)}/payments`, {
      method: 'POST', body: { amount: Number(values.get('amount')), method: values.get('method'), reference: String(values.get('reference') || '').trim(), confirm: values.get('confirm') === 'on' },
    });
    closeModal();
    await loadState({ silent: true, render: false });
    await refreshThread();
    toast('Cobro informado guardado. No fue verificado con el proveedor bancario.');
  } catch (error) { toast(error.message, 'error'); }
}

function openContactModal(thread) {
  const contact = thread.contact || {};
  openModal({
    title: 'Datos del contacto',
    subtitle: 'Un email correcto es la diferencia entre un borrador y una venta.',
    body: `<form id="contact-form" data-thread-id="${attr(thread.id)}">
      <div class="form-grid">
        <div class="field"><label for="ct-company">Empresa</label><input class="input" id="ct-company" name="company" value="${attr(contact.company || '')}" required></div>
        <div class="field"><label for="ct-name">Persona</label><input class="input" id="ct-name" name="name" value="${attr(contact.name || '')}"></div>
        <div class="field"><label for="ct-role">Rol</label><input class="input" id="ct-role" name="role" value="${attr(contact.role || '')}" placeholder="Compras, dueño, curador”¦"></div>
        <div class="field"><label for="ct-type">Tipo</label><input class="input" id="ct-type" name="type" value="${attr(contact.type || '')}" placeholder="tienda, estudio, hotel”¦"></div>
        <div class="field full"><label for="ct-email">Email</label><input class="input" id="ct-email" name="email" type="email" value="${attr(contact.email || '')}" placeholder="compras@tienda.com"></div>
        <div class="field"><label for="ct-country">País</label><input class="input" id="ct-country" name="country" value="${attr(contact.country || '')}"></div>
        <div class="field"><label for="ct-city">Ciudad</label><input class="input" id="ct-city" name="city" value="${attr(contact.city || '')}"></div>
        <div class="field full"><label for="ct-website">Sitio web</label><input class="input" id="ct-website" name="website" value="${attr(contact.website || '')}" placeholder="https://”¦"></div>
        <div class="field full"><label for="ct-permission">Permiso para campañas por Resend</label><select class="select" id="ct-permission" name="permissionStatus"><option value="unknown" ${contact.permission?.status !== 'opted_in' ? 'selected' : ''}>Sin consentimiento documentado (no enviar)</option><option value="opted_in" ${contact.permission?.status === 'opted_in' ? 'selected' : ''}>Dio consentimiento explícito</option></select></div>
        <div class="field full"><label for="ct-evidence">Evidencia del consentimiento</label><textarea class="textarea" id="ct-evidence" name="permissionEvidence" rows="2" placeholder="Formulario, fecha, finalidad y enlace o registro verificable">${esc(contact.permission?.evidence || '')}</textarea></div>
      </div>
      <p class="field-hint mt-3">Lucian no inventa direcciones. Si no tenés un email verificado, dejalo vacío y usá el formulario del sitio o el contacto manual.</p>
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="button" data-action="save-contact" data-id="${attr(thread.id)}">${icon('check')} Guardar contacto</button>`,
  });
}

async function saveContact(threadId) {
  const form = $('#contact-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  data.permission = { status: data.permissionStatus === 'opted_in' ? 'opted_in' : 'unknown', evidence: data.permissionEvidence || '' };
  delete data.permissionStatus;
  delete data.permissionEvidence;
  if (data.email && !isEmail(data.email)) { toast('Ese email no parece válido.', 'error'); return; }
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}`, { method: 'PATCH', body: { contact: data } });
    closeModal();
    await loadState({ silent: true, render: false });
    await refreshThread();
    toast('Contacto actualizado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function openDraftModal(thread) {
  const last = [...arr(thread.messages)].reverse()[0];
  const subject = last?.subject ? `Re: ${String(last.subject).replace(/^Re:\s*/i, '')}` : (thread.contact?.company ? `Una pieza de ${S.state.brand?.name || 'Lucian'} para ${thread.contact.company}` : '');
  openModal({
    title: 'Nuevo borrador',
    subtitle: 'Escribilo una vez. Después podés editarlo, copiarlo o enviarlo con confirmación.',
    size: 'modal-lg',
    body: `<form id="draft-form" data-thread-id="${attr(thread.id)}">
      <div class="form-section">
        <div class="field"><label for="draft-subject">Asunto</label><input class="input" id="draft-subject" name="subject" value="${attr(subject)}" maxlength="300"></div>
        <div class="field mt-3"><label for="draft-body">Cuerpo</label><textarea class="textarea" id="draft-body" name="body" rows="10" required placeholder="Un solo pedido. Un dato concreto. Sin relleno."></textarea></div>
      </div>
      <div class="form-grid">
        <div class="field"><label for="draft-channel">Canal</label><select class="select" id="draft-channel" name="channel">${['email', 'formulario', 'whatsapp', 'otro'].map((c) => `<option value="${c}">${esc(CHANNEL_LABEL[c] || c)}</option>`).join('')}</select></div>
        <div class="field"><label for="draft-language">Idioma</label><input class="input" id="draft-language" name="language" value="es" maxlength="8"></div>
      </div>
      <p class="field-hint mt-2">Se agrega el pie de cumplimiento al enviarlo. En modo demo no sale ningún correo real.</p>
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="button" data-action="save-new-draft" data-id="${attr(thread.id)}">${icon('check')} Crear borrador</button>`,
  });
}

async function saveNewDraft(threadId) {
  const form = $('#draft-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!String(data.body || '').trim()) { toast('El borrador está vacío.', 'error'); return; }
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}/drafts`, {
      method: 'POST',
      body: { subject: data.subject, body: data.body, channel: data.channel, language: data.language },
    });
    closeModal();
    await loadState({ silent: true, render: false });
    await refreshThread();
    toast('Borrador creado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function saveDraftEdit(threadId, draftId) {
  const card = document.querySelector(`[data-draft-card="${CSS.escape(draftId)}"]`);
  if (!card) return;
  const subject = card.querySelector('[data-draft-subject]')?.value || '';
  const body = card.querySelector('[data-draft-body]')?.value || '';
  const channel = card.querySelector('[data-draft-channel]')?.value || 'email';
  const language = card.querySelector('[data-draft-language]')?.value || 'es';
  if (!body.trim()) { toast('El borrador no puede quedar vacío.', 'error'); return; }
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}`, {
      method: 'PATCH', body: { subject, body, channel, language },
    });
    S.ui.threadDraftEdit = null;
    await refreshThread();
    toast('Borrador actualizado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function setDraftStatus(threadId, draftId, status) {
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}`, { method: 'PATCH', body: { status } });
    S.ui.threadDraftEdit = null;
    await refreshThread();
    await loadState({ silent: true, render: false });
    toast(status === 'descartado' ? 'Borrador descartado.' : 'Borrador actualizado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function approveDraft(threadId, draftId) {
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}`, { method: 'PATCH', body: { status: 'listo' } });
    await refreshThread();
    await loadState({ silent: true, render: false });
    toast('Borrador aprobado. Ya se puede enviar.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteDraft(threadId, draftId) {
  const confirmed = await confirmAction({
    title: 'Borrar borrador',
    message: '¿Borrar este borrador definitivamente? No se puede recuperar.',
    confirmLabel: 'Borrar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
    S.ui.threadDraftEdit = null;
    await refreshThread();
    await loadState({ silent: true, render: false });
    toast('Borrador borrado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function openSendModal(thread, draft) {
  const contact = thread.contact || {};
  const settings = S.state.settings || {};
  const from = settings.email?.from || (S.state.brand?.email ? `${S.state.brand?.name || 'Lucian'} <${S.state.brand.email}>` : '');
  const valid = isEmail(contact.email);
  const demoEmail = isDemoEmail(contact.email);
  const suppressed = Boolean(thread.suppressed);
  const gmailReady = settings.email?.provider === 'gmail' && Boolean(S.state.flags?.email);
  const hasConsent = contact.permission?.status === 'opted_in'
    && String(contact.permission?.evidence || '').trim().length >= 10
    && Boolean(contact.permission?.capturedAt);
  const canResend = Boolean(S.state.flags?.email) && valid && !demoEmail && !suppressed && hasConsent;
  const canWebhook = Boolean(settings.email?.webhookUrl) && valid && !demoEmail && !suppressed;
  const canGmail = gmailReady && valid && !demoEmail && !suppressed;
  const limits = S.state.limits || {};
  const subject = draft.subject || '(sin asunto)';
  openModal({
    title: 'Enviar mensaje',
    subtitle: contact.company || contact.name || 'Contacto',
    size: 'modal-lg',
    body: `${suppressed ? '<div class="artifact-callout danger"><b>No contactar</b>Este contacto pidió no recibir más mensajes. Quitá la supresión en Ajustes → No contactar para habilitar el envío.</div>' : ''}
    <div class="artifact-callout ${valid ? '' : suppressed ? '' : 'warn'}">
      <b>${valid ? `Va a ${esc(contact.email)}` : 'Sin email: envío por formulario o LinkedIn'}</b>
      ${valid ? `Desde: ${esc(from || 'sin remitente configurado')}. Asunto: ${esc(subject)}.` : 'Podés copiar el texto, enviarlo por el formulario de la tienda o LinkedIn y marcarlo como contactado. Lucian no inventa direcciones.'}
    </div>
    ${demoEmail ? '<div class="artifact-callout warn mt-3"><b>Email de ejemplo</b>Este contacto es demo (example.com). Podés copiar el texto, descargar el .eml o marcarlo como enviado, pero no se envía a nadie real.</div>' : ''}
    ${limits.limit ? `<p class="small muted mt-3">Hoy: ${limits.used || 0} de ${limits.limit} envíos usados${limits.warmup ? ` · calentamiento, día ${limits.day}` : ''}.</p>` : ''}
    <div class="form-section mt-3"><p class="form-section-title">El mensaje</p>
      <div class="message-card">
        <div class="message-subject">${esc(subject)}</div>
        <div class="message-body" style="max-height:260px;overflow:auto">${esc(draft.body || '')}</div>
      </div>
      <div class="draft-actions">
        ${copyButton(`${subject}\n\n${draft.body || ''}`, 'Copiar mensaje')}
        ${valid && !suppressed ? `<a class="btn btn-ghost btn-xs" href="mailto:${attr(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft.body || '')}">${icon('mail')} Abrir en mi correo</a>` : ''}
        ${valid && !suppressed ? `<button class="btn btn-ghost btn-xs" type="button" data-action="download-eml" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('download')} Descargar .eml</button>` : ''}
      </div>
    </div>
    <div class="form-section"><p class="form-section-title">Cómo lo mandás</p>
      <div class="stack">
        ${gmailReady ? `<div class="integration-card"><span class="status-dot ok"></span><div><h4>Gmail · listo</h4><p>Envío real desde ${esc(settings.email?.from || 'tu Gmail')} con tu contraseña de aplicación. Sale directo, sin copiar nada.</p></div></div>` : ''}
        <div class="integration-card"><span class="status-dot ${canResend ? 'ok' : 'muted'}"></span><div><h4>Resend ${canResend ? '· listo' : '· no disponible'}</h4><p>${canResend ? 'Envío permitido por consentimiento registrado.' : !hasConsent ? 'No hay consentimiento explícito documentado. Editá el contacto para registrar evidencia real.' : 'Requiere verificar un dominio en Resend.'}</p></div></div>
        <div class="integration-card"><span class="status-dot ${canWebhook ? 'ok' : 'muted'}"></span><div><h4>Webhook propio ${canWebhook ? '· listo' : '· opcional'}</h4><p>${canWebhook ? 'Lucian manda el mensaje a tu automatización.' : 'Ideal si ya tenés Make, n8n o un servidor propio.'}</p></div></div>
      </div>
    </div>`,
    footer: `${suppressed ? '<span class="tiny muted" style="margin-right:auto">Contacto en la lista de no contactar.</span>' : ''}
      <button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button>
      ${canGmail ? `<button class="btn btn-accent" type="button" data-action="send-channel" data-channel="gmail" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('send')} Enviar con Gmail</button>` : ''}
      ${canWebhook ? `<button class="btn btn-ghost" type="button" data-action="send-channel" data-channel="webhook" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('send')} Webhook</button>` : ''}
      ${canResend && !gmailReady ? `<button class="btn btn-ghost" type="button" data-action="send-channel" data-channel="resend" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}">${icon('send')} Enviar con Resend</button>` : ''}
      <button class="btn ${canGmail || canResend || canWebhook ? 'btn-ghost' : 'btn-primary'}" type="button" data-action="send-channel" data-channel="manual" data-id="${attr(thread.id)}" data-draft-id="${attr(draft.id)}" ${suppressed ? 'disabled' : ''}>${icon('check')} Ya lo envié</button>`,
  });
}

async function sendDraftChannel(threadId, draftId, channel) {
  const thread = S.thread?.thread;
  const draft = arr(thread?.drafts).find((d) => d.id === draftId);
  if (!thread || !draft) { toast('No encontré el borrador.', 'error'); return; }
  const contact = thread.contact || {};
  const real = channel !== 'manual';
  const confirmed = await confirmAction({
    title: real ? 'Enviar correo real' : 'Marcar como enviado',
    message: real
      ? `Se va a enviar un correo a ${contact.email || 'el contacto'} desde ${S.state.settings?.email?.from || S.state.brand?.email || 'tu remitente'}. Esta acción no se puede deshacer.`
      : `Confirmá que ya enviaste este mensaje a ${contact.company || contact.email || 'el contacto'} ${contact.email ? 'desde tu correo' : 'por el formulario o LinkedIn'}. Lucian solo lo registra; no envía nada.`,
    details: real ? 'Revisá asunto, cuerpo y destinatario antes de continuar.' : '',
    confirmLabel: real ? 'Sí, enviar' : 'Sí, ya lo envié',
    danger: real,
  });
  if (!confirmed) return;
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}/send`, {
      method: 'POST',
      body: { draftId, channel, confirm: channel === 'manual' ? true : undefined },
    });
    closeModal(true);
    await loadState({ silent: true, render: false });
    await refreshThread();
    toast(real ? 'Mensaje enviado.' : 'Mensaje marcado como enviado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function downloadEml(threadId, draftId) {
  try {
    const response = await api(`/api/threads/${encodeURIComponent(threadId)}/eml?draftId=${encodeURIComponent(draftId)}`, { raw: true, silent: true });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Error ${response.status} al preparar el .eml`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plain = disposition.match(/filename="([^"]+)"/i);
    let filename = 'mensaje.eml';
    if (utf) { try { filename = decodeURIComponent(utf[1]); } catch { /* noop */ } }
    else if (plain) filename = plain[1];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Archivo .eml descargado. Podés abrirlo en tu correo y revisarlo antes de enviar.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteThread(threadId) {
  const confirmed = await confirmAction({
    title: 'Eliminar conversación',
    message: 'Se borran los mensajes, borradores y notas de esta conversación. Los datos del comprador no se tocan en otro lado.',
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api(`/api/threads/${encodeURIComponent(threadId)}`, { method: 'DELETE' });
    S.thread = null;
    await loadState({ silent: true, render: false });
    navigate('#/bandeja');
    toast('Conversación eliminada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function bindInbox() {
  const search = $('#inbox-search');
  if (search) {
    search.addEventListener('input', () => {
      S.ui.inboxQuery = search.value;
      applyInboxList();
    });
  }
}

/* ─────────────────────────────────────────────────────────────
   15. Contenido
   ───────────────────────────────────────────────────────────── */

const CONTENT_PLATFORMS = ['Instagram', 'TikTok', 'Pinterest', 'Facebook', 'LinkedIn', 'YouTube', 'Newsletter', 'Feria', 'Otro'];
const SOCIAL_NETWORKS = [
  { id: 'Instagram', label: 'Instagram', color: '#e1306c', url: 'https://www.instagram.com/' },
  { id: 'TikTok', label: 'TikTok', color: '#25f4ee', url: 'https://www.tiktok.com/upload' },
  { id: 'Pinterest', label: 'Pinterest', color: '#e60023', url: 'https://www.pinterest.com/pin/create/' },
  { id: 'Facebook', label: 'Facebook', color: '#4267b2', url: 'https://www.facebook.com/' },
];
const CONTENT_TONES = { idea: 'neutral', borrador: 'amber', publicado: 'ok', archivado: 'neutral' };

function filteredContent() {
  const q = String(S.ui.contentQuery || '').trim().toLowerCase();
  return sortByDate(arr(S.state?.content), 'createdAt').filter((item) => {
    if (S.ui.contentFilter !== 'todos' && item.status !== S.ui.contentFilter) return false;
    if (S.ui.contentPlatform !== 'todas' && String(item.platform || '').toLowerCase() !== S.ui.contentPlatform.toLowerCase()) return false;
    if (S.ui.contentProduct && S.ui.contentProduct !== 'todos' && item.productId !== S.ui.contentProduct) return false;
    if (!q) return true;
    return [item.platform, item.format, item.hook, item.caption, item.script, item.cta, item.day, arr(item.hashtags).join(' ')]
      .some((value) => String(value || '').toLowerCase().includes(q));
  });
}

function contentListHTML() {
  const items = filteredContent();
  if (!items.length) {
    return `<div class="card card-pad" style="text-align:center;color:var(--muted)">No hay piezas que coincidan con el filtro.</div>`;
  }
  return items.map(contentCardHTML).join('');
}

function renderContent() {
  const all = arr(S.state?.content);
  const counts = {
    total: all.length,
    ideas: all.filter((c) => c.status === 'idea').length,
    drafts: all.filter((c) => c.status === 'borrador').length,
    published: all.filter((c) => c.status === 'publicado').length,
  };
  const platforms = [...new Set(all.map((c) => c.platform).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Contenido</p>
      <h2 class="page-title">Mostrar la luz, no gritar “comprá”.</h2>
      <p class="page-sub">El equipo convierte cada lámpara en una serie de piezas: la sombra, el proceso, el objeto en una casa real. Revisá, editá y publicá a tu ritmo.</p>
    </div>
    <div class="page-actions">
      <a class="btn btn-ghost btn-sm" href="#/misiones/nueva">${icon('spark')} Pedir contenido al equipo</a>
      ${all.length ? `<button class="btn btn-danger btn-sm" type="button" data-action="delete-all-content">${icon('trash')} Borrar todo (${all.length})</button>` : ''}
    </div>
  </div>

  <section class="stat-grid">
    ${contentStat('Piezas totales', counts.total, 'image', 'ideas, borradores y publicadas')}
    ${contentStat('Ideas', counts.ideas, 'spark', 'para elegir esta semana')}
    ${contentStat('Borradores', counts.drafts, 'edit', 'esperando una última mirada')}
    ${contentStat('Publicadas', counts.published, 'check', 'ya vieron la luz')}
  </section>

  ${all.length ? `<div class="filterbar mt-4">
    <div class="search-field">${icon('search')}<input class="input" id="content-search" type="search" value="${attr(S.ui.contentQuery || '')}" placeholder="Buscar gancho, caption o plataforma”¦"></div>
    <select class="select" id="content-status-filter" style="max-width:170px" aria-label="Filtrar por estado">
      ${[['todos', 'Todos los estados'], ['idea', 'Ideas'], ['borrador', 'Borradores'], ['publicado', 'Publicadas'], ['archivado', 'Archivadas']].map(([value, label]) => `<option value="${value}" ${S.ui.contentFilter === value ? 'selected' : ''}>${label}</option>`).join('')}
    </select>
    <select class="select" id="content-platform-filter" style="max-width:170px" aria-label="Filtrar por plataforma">
      <option value="todas" ${S.ui.contentPlatform === 'todas' ? 'selected' : ''}>Todas las plataformas</option>
      ${platforms.map((p) => `<option value="${attr(p)}" ${S.ui.contentPlatform === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
    </select>
    <select class="select" id="content-product-filter" style="max-width:170px" aria-label="Filtrar por lámpara">
      <option value="todos" ${S.ui.contentProduct === 'todos' ? 'selected' : ''}>Todas las lámparas</option>
      ${arr(S.state?.products).map((p) => `<option value="${attr(p.id)}" ${S.ui.contentProduct === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
    </select>
    <span class="small muted" id="content-count">${filteredContent().length} pieza${filteredContent().length === 1 ? '' : 's'}</span>
  </div>
  <div class="content-list" id="content-list">${contentListHTML()}</div>`
    : emptyState({
      iconName: 'image',
      title: 'Todavía no hay contenido',
      text: 'Cuando una misión incluye el paso de contenido, el equipo deja un calendario con ganchos, guiones y captions. Todo queda como idea o borrador para que lo revises.',
      actions: arr(S.state?.products).length
        ? `<a class="btn btn-primary" href="#/misiones/nueva">${icon('spark')} Lanzar una misión</a>`
        : `<button class="btn btn-primary" type="button" data-action="new-product">${icon('plus')} Cargar una lámpara</button>`,
    })}`;
}

function contentStat(label, value, iconName, foot) {
  return `<div class="stat">
    <div class="stat-top"><span class="stat-label">${esc(label)}</span><span class="stat-icon">${icon(iconName)}</span></div>
    <div class="stat-value">${esc(value)}</div>
    <div class="stat-foot">${esc(foot)}</div>
  </div>`;
}

function contentCardHTML(item) {
  const product = arr(S.state?.products).find((p) => p.id === item.productId);
  const mission = arr(S.state?.missions).find((m) => m.id === item.missionId);
  return `<article class="content-card" data-content-id="${attr(item.id)}">
    <div class="content-top">
      <div style="min-width:0;flex:1">
        <div class="content-platform">${icon('image')} ${esc(item.platform || 'Sin plataforma')}${item.format ? ` · ${esc(item.format)}` : ''} ${demoBadge(item.demo)}</div>
        <div class="content-hook">${esc(item.hook || '(sin gancho)')}</div>
        ${product ? `<p class="tiny" style="margin-top:4px"><a href="#/productos/${encodeURIComponent(product.id)}" style="color:var(--amber-deep);text-decoration:none;font-weight:600">${esc(product.name)}</a>${mission ? ` · <a href="#/misiones/${encodeURIComponent(mission.id)}" style="color:var(--muted);text-decoration:none">${esc(mission.name)}</a>` : ''}</p>` : (mission ? `<p class="tiny muted" style="margin-top:4px"><a href="#/misiones/${encodeURIComponent(mission.id)}" style="color:var(--amber-deep);text-decoration:none">${esc(mission.name)}</a></p>` : '')}
        ${item.status === 'publicado' ? `<p class="tiny" style="margin-top:4px;color:var(--ok)">${icon('check','icon-sm')} Publicado${item.publishedAt ? ` el ${esc(dateTime(item.publishedAt))}` : ''}${item.publishedUrl ? ` · <a href="${attr(safeUrl(item.publishedUrl))}" target="_blank" rel="noopener noreferrer" style="color:var(--ok);text-decoration:underline">ver publicación</a>` : ''}</p>` : ''}
      </div>
      <span class="content-day">${esc(item.day || '')}</span>
    </div>
    ${item.script ? `<p class="content-script"><b>Guion:</b> ${esc(item.script)}</p>` : ''}
    ${item.caption ? `<div class="content-caption">${esc(item.caption)}</div>` : ''}
    ${arr(item.hashtags).length ? `<div class="hashtags" style="margin-top:8px">${item.hashtags.map((h) => `<span>${esc(h)}</span>`).join('')}</div>` : ''}
    <div class="content-foot">
      <span class="content-cta"><b>CTA:</b> ${esc(item.cta || '””')}</span>
      <div class="cluster">
        <select class="select" style="min-height:30px;font-size:11px;max-width:130px" data-content-status="${attr(item.id)}" aria-label="Estado de la pieza">
          ${Object.entries(CONTENT_STATUS).map(([value, label]) => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        ${item.status !== 'publicado' ? `<button class="btn btn-ghost btn-xs" type="button" data-action="content-publish" data-id="${attr(item.id)}">${icon('check')} Publicar</button>` : ''}
        <button class="btn btn-ghost btn-xs" type="button" data-action="content-edit" data-id="${attr(item.id)}">${icon('edit')} Editar</button>
        ${copyButton(`${item.hook || ''}\n\n${item.caption || ''}\n\n${arr(item.hashtags).join(' ')}`, 'Copiar pieza')}
        <button class="btn btn-ghost btn-xs" type="button" data-action="content-delete" data-id="${attr(item.id)}" aria-label="Eliminar pieza" title="Eliminar">${icon('trash')}</button>
      </div>
    </div>
  </article>`;
}

function publishText(item) {
  return [item.hook || '', item.caption || '', arr(item.hashtags).join(' ')].filter(Boolean).join('\n\n');
}

function openPublishModal(item) {
  const text = publishText(item);
  openModal({
    title: 'Centro de publicación',
    subtitle: item.hook || item.platform || 'Contenido listo para publicar',
    size: 'modal-lg',
    body: `<div class="publish-hub">
      <div class="artifact-callout info"><b>Cómo funciona:</b> tocá una red → se copia el texto automáticamente y se abre la web de esa red. Pegás el texto, subís la foto y publicás. Después volvés acá y marcás dónde la publicaste.</div>

      <div class="form-section">
        <p class="form-section-title">1. Elegí la red (copia el texto y abre la red)</p>
        <div class="social-buttons">
          ${SOCIAL_NETWORKS.map((net) => `<button class="social-btn" type="button" data-action="social-open" data-network="${attr(net.id)}" data-url="${attr(net.url)}" style="--net:${net.color}">
            ${icon('external')} <span>${esc(net.label)}</span>
          </button>`).join('')}
        </div>
      </div>

      <div class="form-section">
        <div class="between">
          <p class="form-section-title" style="margin:0">2. Texto listo para pegar</p>
          ${copyButton(text, 'Copiar texto')}
        </div>
        <div class="message-card mt-2"><div class="message-body" style="max-height:170px;overflow:auto;white-space:pre-wrap">${esc(text)}</div></div>
      </div>

      <form id="publish-form" data-id="${attr(item.id)}">
        <div class="form-section">
          <p class="form-section-title">3. Registrá dónde la publicaste</p>
          <div class="form-grid">
            <div class="field"><label for="pub-platform">Red donde se publicó</label>
              <select class="select" id="pub-platform" name="platform">
                ${SOCIAL_NETWORKS.map((net) => `<option value="${attr(net.id)}" ${(item.platform || '') === net.id ? 'selected' : ''}>${esc(net.label)}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label for="pub-date">Fecha</label><input class="input" id="pub-date" name="publishedAt" type="datetime-local" value="${attr(dateTimeLocal(item.publishedAt || new Date().toISOString()))}"></div>
            <div class="field full"><label for="pub-url">Enlace de la publicación (opcional)</label><input class="input" id="pub-url" name="publishedUrl" type="url" value="${attr(item.publishedUrl || '')}" placeholder="https://instagram.com/p/..."></div>
          </div>
        </div>
      </form>
    </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cerrar</button>
      <button class="btn btn-accent" type="button" data-action="save-publish" data-id="${attr(item.id)}">${icon('check')} Ya la publiqué</button>`,
  });
}

async function socialOpen(network, url) {
  // Abrir la red PRIMERO (sin await) para que no se bloquee si el
  // portapapeles tarda o falla. Después copiamos el texto en segundo plano.
  const target = safeUrl(url);
  if (target) window.open(target, '_blank', 'noopener,noreferrer');
  const item = arr(S.state.content).find((c) => c.id === $('#publish-form')?.dataset.id);
  const text = item ? publishText(item) : '';
  if (text) copyToClipboard(text, `Texto copiado. Pegalo en ${network}.`).catch(() => {});
}

async function savePublish(id) {
  const form = $('#publish-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const url = String(data.publishedUrl || '').trim();
  const item = arr(S.state.content).find((c) => c.id === id);
  try {
    const result = await api(`/api/content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        status: 'publicado',
        platform: data.platform || item?.platform || '',
        publishedUrl: url,
        publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString() : undefined,
      },
    });
    const index = arr(S.state.content).findIndex((c) => c.id === id);
    if (index >= 0) S.state.content[index] = result.item;
    closeModal();
    updateShell();
    applyContentList();
    toast('Pieza marcada como publicada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function bindContent() {
  const search = $('#content-search');
  if (search) {
    search.addEventListener('input', () => {
      S.ui.contentQuery = search.value;
      applyContentList();
    });
  }
  const status = $('#content-status-filter');
  if (status) status.addEventListener('change', () => { S.ui.contentFilter = status.value; applyContentList(); });
  const platform = $('#content-platform-filter');
  if (platform) platform.addEventListener('change', () => { S.ui.contentPlatform = platform.value; applyContentList(); });
  const product = $('#content-product-filter');
  if (product) product.addEventListener('change', () => { S.ui.contentProduct = product.value; applyContentList(); });
}

function applyContentList() {
  const list = $('#content-list');
  if (!list) return;
  list.innerHTML = contentListHTML();
  const count = $('#content-count');
  if (count) {
    const total = filteredContent().length;
    count.textContent = `${total} pieza${total === 1 ? '' : 's'}`;
  }
}

async function updateContentStatus(id, status) {
  try {
    const result = await api(`/api/content/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
    const index = arr(S.state.content).findIndex((c) => c.id === id);
    if (index >= 0) S.state.content[index] = result.item;
    S.state.counts = { ...(S.state.counts || {}), content: S.state.content.length, contentIdeas: S.state.content.filter((c) => c.status === 'idea').length };
    updateShell();
    applyContentList();
    toast(`Pieza marcada como ${CONTENT_STATUS[status] || status}.`);
  } catch (error) {
    toast(error.message, 'error');
    applyContentList();
  }
}

function openContentModal(item) {
  openModal({
    title: 'Editar pieza',
    subtitle: item.platform || 'Contenido',
    size: 'modal-lg',
    body: `<form id="content-form" data-id="${attr(item.id)}">
      <div class="form-grid">
        <div class="field"><label for="cnt-platform">Plataforma</label><input class="input" id="cnt-platform" name="platform" value="${attr(item.platform || '')}" list="platform-list"><datalist id="platform-list">${CONTENT_PLATFORMS.map((p) => `<option value="${attr(p)}">`).join('')}</datalist></div>
        <div class="field"><label for="cnt-format">Formato</label><input class="input" id="cnt-format" name="format" value="${attr(item.format || '')}" placeholder="Reel, carrusel, historia”¦"></div>
        <div class="field"><label for="cnt-day">Día / momento</label><input class="input" id="cnt-day" name="day" value="${attr(item.day || '')}" placeholder="Día 1"></div>
        <div class="field"><label for="cnt-status">Estado</label><select class="select" id="cnt-status" name="status">${Object.entries(CONTENT_STATUS).map(([value, label]) => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
        <div class="field full"><label for="cnt-hook">Gancho</label><input class="input" id="cnt-hook" name="hook" value="${attr(item.hook || '')}" maxlength="240"></div>
        <div class="field full"><label for="cnt-script">Guion</label><textarea class="textarea" id="cnt-script" name="script" rows="4">${esc(item.script || '')}</textarea></div>
        <div class="field full"><label for="cnt-caption">Caption</label><textarea class="textarea" id="cnt-caption" name="caption" rows="6">${esc(item.caption || '')}</textarea></div>
        <div class="field full"><label for="cnt-hashtags">Hashtags</label><input class="input" id="cnt-hashtags" name="hashtags" value="${attr(arr(item.hashtags).join(' '))}" placeholder="#luzdecora #lamparas3d"></div>
        <div class="field full"><label for="cnt-cta">Llamada a la acción</label><input class="input" id="cnt-cta" name="cta" value="${attr(item.cta || '')}"></div>
        <div class="field full"><label for="cnt-published-url">Enlace de la publicación (si ya se publicó)</label><input class="input" id="cnt-published-url" name="publishedUrl" type="url" value="${attr(item.publishedUrl || '')}" placeholder="https://instagram.com/p/..."></div>
        <div class="field"><label for="cnt-published-at">Publicado el</label><input class="input" id="cnt-published-at" name="publishedAt" type="datetime-local" value="${attr(dateTimeLocal(item.publishedAt))}"></div>
      </div>
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="button" data-action="save-content" data-id="${attr(item.id)}">${icon('check')} Guardar pieza</button>`,
  });
}

async function saveContentEdit(id) {
  const form = $('#content-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const hashtags = String(data.hashtags || '').split(/[\s,]+/).map((h) => h.trim()).filter(Boolean).map((h) => h.startsWith('#') ? h : `#${h}`);
  try {
    const result = await api(`/api/content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: {
        platform: data.platform, format: data.format, day: data.day, status: data.status,
        hook: data.hook, script: data.script, caption: data.caption, cta: data.cta, hashtags,
        publishedUrl: String(data.publishedUrl || '').trim(),
        publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString() : (data.publishedUrl ? undefined : ''),
      },
    });
    const index = arr(S.state.content).findIndex((c) => c.id === id);
    if (index >= 0) S.state.content[index] = result.item;
    closeModal();
    updateShell();
    applyContentList();
    toast('Pieza actualizada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteContent(id) {
  const item = arr(S.state.content).find((c) => c.id === id);
  const confirmed = await confirmAction({
    title: 'Eliminar pieza',
    message: `¿Eliminar “${item?.hook || 'esta pieza'}”? No se puede recuperar.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api(`/api/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadState({ silent: true, render: false });
    render();
    toast('Pieza eliminada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   16. Equipo
   ───────────────────────────────────────────────────────────── */

const ASK_SUGGESTIONS = {
  director: ['¿Cuál es el siguiente paso más importante esta semana?', '¿Qué mercado debería priorizar y por qué?', '¿Qué harías con los borradores que tengo en la bandeja?'],
  mercado: ['¿Qué están vendiendo las tiendas de diseño en mi rango de precio?', '¿Qué términos de búsqueda usa mi comprador?', '¿La tendencia de lámparas impresas en 3D tiene demanda real?'],
  aduanas: ['¿Qué certificaciones necesito para vender en la UE?', '¿Cómo cotizo el envío a Estados Unidos sin sorpresas?', '¿Qué riesgo hay en mi código HS?'],
  precios: ['¿Mi precio mayorista deja margen sano?', '¿Cuánto puedo descontar sin fundir el negocio?', '¿Cómo armo el costo aterrizado para España?'],
  cazador: ['¿Dónde busco compradores que ya vendan diseño?', '¿Cómo verifico un email antes de escribir?', '¿Qué tipo de tienda responde mejor a una pieza de autor?'],
  redactor: ['¿Cómo abro un correo sin sonar a plantilla?', '¿Qué hago si me piden precio en el primer mensaje?', 'Revisá el tono de mi secuencia de seguimiento.'],
  contenido: ['¿Qué serie de contenido muestra mejor la sombra de la lámpara?', '¿Qué ganchos funcionan sin mostrar la impresora?', '¿Cómo convierto una feria en contenido?'],
  cumplimiento: ['¿Qué claims tengo que evitar en mi web?', '¿Puedo escribir a tiendas sin opt-in?', '¿Qué debe decir el pie de mis correos?'],
  redteam: ['¿Por qué puede fracasar mi plan de ventas?', '¿Qué supuesto es el más frágil?', '¿Qué prueba barata harías antes de invertir?'],
  memoria: ['¿Qué aprendí en las últimas misiones?', '¿Qué patrón se repite en los compradores?', '¿Qué no debería volver a hacer?'],
  analista: ['¿Qué hago con la última respuesta de un comprador?', '¿Qué conversación está más cerca de cerrar?', '¿Cómo respondo a una objeción de certificación?'],
};

function renderTeam() {
  const usage = S.state?.usage || {};
  const totalUsage = Object.values(usage).reduce((acc, value) => acc + num(value), 0);
  const ask = S.ui.ask;
  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">El equipo</p>
      <h2 class="page-title">Once especialistas. Una sola persona al mando.</h2>
      <p class="page-sub">No es un chatbot que escribe párrafos. Cada rol tiene un trabajo distinto, se contradice con los demás y deja un resultado que podés usar o descartar.</p>
    </div>
    <div class="page-actions">
      <a class="btn btn-primary" href="#/misiones/nueva">${icon('spark')} Ponerlos a trabajar</a>
    </div>
  </div>

  <section class="card card-pad" style="background:linear-gradient(145deg,#eff6ff,rgba(255,250,241,.7));border-color:#e6d3b2">
    <div class="section-head" style="margin-bottom:12px">
      <div>
        <p class="eyebrow">Consulta directa</p>
        <h3 class="section-title" style="font-size:24px">Preguntale al equipo</h3>
        <p class="section-sub">Usa tu catálogo, tus misiones, la bandeja y los aprendizajes como contexto. No inventa datos de mercado que no estén en el sistema.</p>
      </div>
      ${totalUsage ? `<span class="badge badge-neutral">${icon('spark')} ${totalUsage} participaciones</span>` : ''}
    </div>
    <form id="ask-form">
      <div class="ask-box">
        <div class="field"><label for="ask-agent">Especialista</label>
          <select class="select" id="ask-agent" name="agentId">
            ${AGENTS.map((agent) => `<option value="${agent.id}" ${ask.agentId === agent.id ? 'selected' : ''}>${esc(agent.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label for="ask-question">Tu pregunta</label>
          <textarea class="textarea" id="ask-question" name="question" rows="3" placeholder="Ej.: tengo cinco borradores en la bandeja, ¿por cuál empiezo y qué digo?" maxlength="2500">${esc(ask.question || '')}</textarea>
        </div>
      </div>
      <div class="between mt-3" style="flex-wrap:wrap;align-items:flex-start">
        <div class="artifact-chips">
          ${(ASK_SUGGESTIONS[ask.agentId] || ASK_SUGGESTIONS.director).map((question) => `<button class="chip" type="button" data-action="ask-suggestion" data-question="${attr(question)}">${esc(truncate(question, 56))}</button>`).join('')}
        </div>
        <button class="btn btn-primary" type="submit" id="ask-submit" ${ask.loading ? 'disabled' : ''}>${ask.loading ? `${icon('refresh', 'spin')} Pensando”¦` : `${icon('spark')} Preguntar`}</button>
      </div>
    </form>
    ${!S.state.flags?.ai ? '<div class="artifact-callout warn mt-3"><b>Modo demo</b>Sin una IA configurada, las respuestas son ejemplos del sistema. Configurá un proveedor en Ajustes para consultas reales sobre tus datos.</div>' : ''}
    ${ask.result ? `<div class="answer-box">
      <div class="answer-head">${agentAvatar(ask.result.agent?.id || ask.agentId)}<div><b style="font-size:13px">${esc(ask.result.agent?.name || agentById(ask.agentId).name)}</b><p class="tiny muted">${ask.result.demo ? 'Respuesta de ejemplo' : 'Consulta real sobre tus datos'}${(ask.result.usage?.total ?? ask.result.usage?.total_tokens) ? ` · ${numFmt(ask.result.usage?.total ?? ask.result.usage?.total_tokens)} tokens` : ''}</p></div></div>
      <div class="answer-text">${esc(ask.result.answer || '')}</div>
      <div class="artifact-chips mt-3">${copyButton(ask.result.answer || '', 'Copiar respuesta')}${ask.result.note ? `<span class="tiny muted" style="align-self:center">${esc(ask.result.note)}</span>` : ''}</div>
    </div>` : ''}
  </section>

  <section class="section">
    <div class="section-head">
      <div><h2 class="section-title">Quién hace qué</h2><p class="section-sub">El mismo producto, mirado por once pares de ojos distintos.</p></div>
      <span class="badge badge-neutral">${AGENTS.length} roles</span>
    </div>
    <div class="team-grid">${AGENTS.map(agentFullCard).join('')}</div>
  </section>

  <section class="section card card-pad">
    <div class="section-head"><div><h2 class="section-title">Cómo trabaja una misión</h2><p class="section-sub">Sin magia: un orden, contratos de salida y una revisión final.</p></div><a class="section-link" href="#/misiones/nueva">Lanzar una ${icon('arrowRight')}</a></div>
    <div class="flow">
      ${['Brief', 'Mercado', 'Aduanas', 'Precios', 'Compradores', 'Contactos', 'Mensajes', 'Contenido', 'Cumplimiento', 'Red team', 'Plan final'].map((step, index, list) => `<span class="flow-step"><b>${index + 1}</b>${step}</span>${index < list.length - 1 ? `<span class="flow-arrow">${icon('chevronRight')}</span>` : ''}`).join('')}
    </div>
    <div class="artifact-grid-2 mt-3">
      <div class="artifact-card"><h5>Qué devuelve</h5><p>Una tesis, países priorizados, aranceles, precios con margen, compradores concretos, mensajes personalizados, calendario de contenido y un plan de 7 días.</p></div>
      <div class="artifact-card"><h5>Qué no hace</h5><p>No envía nada sin tu confirmación, no compra listas, no inventa emails y no reemplaza a un despachante de aduanas ni a un abogado.</p></div>
    </div>
  </section>`;
}

function agentFullCard(agent) {
  const usage = S.state?.usage?.[agent.id] || 0;
  return `<article class="agent-card" style="--agent-tint:${agent.color}22">
    <div class="agent-top">${agentAvatar(agent.id, 'lg')}<div style="min-width:0"><div class="agent-name">${esc(agent.name)}</div><div class="agent-role">${esc(agent.role)}</div></div></div>
    <p class="agent-bio">${esc(agent.bio)}</p>
    <div class="agent-focus">${agent.focus.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
    <div class="between mt-3">
      ${usage ? `<span class="agent-usage" style="margin:0">${icon('spark')} <b>${usage}</b> participaciones</span>` : '<span class="agent-usage" style="margin:0">Todavía sin participar</span>'}
      <button class="btn btn-ghost btn-xs" type="button" data-action="ask-agent" data-id="${agent.id}">Preguntar ${icon('arrowRight')}</button>
    </div>
  </article>`;
}

function dedupeAnswer(text) {
  let s = String(text || '').trim();
  if (s.startsWith('{')) {
    try {
      const obj = JSON.parse(s);
      for (const key of ['answer', 'respuesta', 'text', 'response', 'mensaje']) {
        if (typeof obj[key] === 'string') { s = obj[key].trim(); break; }
      }
    } catch { /* no era JSON */ }
  }
  if (!s) return s;
  // Algunos proveedores repiten la respuesta completa dos veces seguidas.
  const mid = Math.floor(s.length / 2);
  const half = s.slice(0, mid).trim();
  if (s.slice(mid).trim() === half) return half;
  // También puede repetirse separado por salto de línea.
  const parts = s.split(/\n\s*\n/);
  if (parts.length % 2 === 0) {
    const h = parts.length / 2;
    if (parts.slice(0, h).join('\n\n').trim() === parts.slice(h).join('\n\n').trim()) {
      return parts.slice(0, h).join('\n\n').trim();
    }
  }
  return s;
}

async function askTeamSubmit() {
  const form = $('#ask-form');
  if (!form) return;
  const agentId = String(form.querySelector('#ask-agent')?.value || 'director');
  const question = String(form.querySelector('#ask-question')?.value || '').trim();
  if (!question) { toast('Escribí una pregunta concreta.', 'error'); form.querySelector('#ask-question')?.focus(); return; }
  S.ui.ask = { ...S.ui.ask, agentId, question, loading: true };
  const button = $('#ask-submit');
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Pensando”¦`; }
  try {
    const result = await api('/api/ask', { method: 'POST', body: { question, agentId } });
    if (result && typeof result.answer === 'string') result.answer = dedupeAnswer(result.answer);
    S.ui.ask = { agentId, question, result, loading: false };
    await loadState({ silent: true, render: false });
    render();
    setTimeout(() => $('.answer-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  } catch (error) {
    S.ui.ask = { ...S.ui.ask, loading: false };
    toast(error.message, 'error');
    render();
  }
}

function fillAskSuggestion(question) {
  S.ui.ask = { ...S.ui.ask, question };
  const textarea = $('#ask-question');
  if (textarea) { textarea.value = question; textarea.focus(); }
  const agentSelect = $('#ask-agent');
  if (agentSelect) S.ui.ask.agentId = agentSelect.value;
}

/* ─────────────────────────────────────────────────────────────
   17. Mercados y aprendizajes
   ───────────────────────────────────────────────────────────── */

const LEARNING_TAGS = [
  ['todos', 'Todos'],
  ['precio', 'Precio'],
  ['mensaje', 'Mensaje'],
  ['mercado', 'Mercado'],
  ['aduanas', 'Aduanas'],
  ['operacion', 'Operación'],
];

function renderMarkets() {
  const intel = S.state?.intel || {};
  const countries = arr(intel.countries);
  const sources = arr(intel.sources);
  const learnings = arr(S.state?.learnings);
  const filter = S.ui.learningFilter || 'todos';
  const visibleLearnings = learnings.filter((l) => filter === 'todos' || l.tag === filter)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Mercados</p>
      <h2 class="page-title">Lo que el equipo ya aprendió.</h2>
      <p class="page-sub">Aranceles, certificaciones, fuentes y patrones de compra que se acumulan misión a misión. Si algo no tiene evidencia, queda marcado como supuesto.</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-ghost" type="button" data-action="add-learning">${icon('plus')} Agregar aprendizaje</button>
      <a class="btn btn-primary" href="#/misiones/nueva">${icon('spark')} Nueva misión</a>
    </div>
  </div>

  <section class="stat-grid">
    ${contentStat('Países relevados', countries.length, 'globe', 'con datos de aduanas')}
    ${contentStat('Aprendizajes', learnings.length, 'sun', learnings.filter((l) => l.pinned).length ? `${learnings.filter((l) => l.pinned).length} fijados` : 'memoria del equipo')}
    ${contentStat('Fuentes', sources.length, 'link', 'para verificar antes de citar')}
    ${contentStat('Misiones', S.state?.counts?.missions || 0, 'spark', 'de donde sale la inteligencia')}
  </section>

  ${countries.length ? `<section class="section">
    <div class="section-head"><div><h2 class="section-title">País por país</h2><p class="section-sub">Lo último que dijo Aduanas en cada mercado. Verificá siempre antes de un envío real.</p></div></div>
    <div class="country-grid">${countries.map(marketCountryCard).join('')}</div>
  </section>` : `<section class="section">${emptyState({
    iconName: 'globe',
    title: 'Todavía no hay inteligencia de mercados',
    text: 'Cuando una misión incluye aduanas, el especialista deja aranceles, impuestos, certificaciones y couriers por país. Esa información se acumula acá.',
    actions: '<a class="btn btn-primary" href="#/misiones/nueva">Lanzar una misión con aduanas</a>',
  })}</section>`}

  <section class="section">
    <div class="section-head">
      <div><h2 class="section-title">Aprendizajes</h2><p class="section-sub">Lo que esta marca aprendió sobre precios, mensajes y operación.</p></div>
      <button class="btn btn-ghost btn-sm" type="button" data-action="add-learning">${icon('plus')} Agregar</button>
    </div>
    <div class="inbox-filters" style="margin-bottom:12px">
      ${LEARNING_TAGS.map(([value, label]) => `<button class="chip ${filter === value ? 'active' : ''}" type="button" data-action="learning-filter" data-filter="${value}">${label}</button>`).join('')}
    </div>
    ${visibleLearnings.length ? `<div class="learning-list">${visibleLearnings.map(learningCardHTML).join('')}</div>` : `<div class="card card-pad" style="text-align:center"><p class="muted small">${learnings.length ? 'No hay aprendizajes con esa etiqueta.' : 'Todavía no hay aprendizajes guardados. Una misión completa los crea por vos.'}</p></div>`}
  </section>

  <section class="section">
    <div class="section-head"><div><h2 class="section-title">Fuentes</h2><p class="section-sub">Links que el equipo usó. Abrilo antes de repetir un dato.</p></div></div>
    <div class="card card-pad">
      ${sources.length ? `<div class="sources-list">${sources.map((source) => `<div class="source-row">${icon('link')}<div><a href="${attr(safeUrl(source.url) || '#')}" target="_blank" rel="noopener noreferrer">${esc(source.titulo || source.url)}</a><span>${esc(source.url)}${source.pais ? ` · ${esc(source.pais)}` : ''}</span></div></div>`).join('')}</div>` : '<p class="small muted">Las fuentes aparecen cuando el equipo investiga mercado o aduanas en una misión real.</p>'}
    </div>
  </section>`;
}

function marketCountryCard(country) {
  return `<div class="country-card">
    <div class="country-card-head"><h5>${esc(country.pais)} ${demoBadge(country.demo)}</h5>${riskBadge(country.riesgo)}<span class="badge ${country.fuente_verificada ? 'badge-ok' : 'badge-warn'}">${country.fuente_verificada ? 'Confirmado en fuente' : 'Hipótesis del modelo'}</span></div>
    <div class="country-line"><span>Arancel</span><b>${esc(country.arancel || 'sin dato')}</b></div>
    <div class="country-line"><span>Impuestos</span><b>${esc(country.impuestos || 'sin dato')}</b></div>
    <div class="country-line"><span>Incoterm</span><b>${esc(country.incoterm || 'sin dato')}</b></div>
    <div class="country-line"><span>Courier</span><b>${esc(country.courier || 'sin dato')}</b></div>
    ${arr(country.certificaciones).length ? `<div class="artifact-chips mt-2">${country.certificaciones.map((c) => `<span class="artifact-chip">${esc(c)}</span>`).join('')}</div>` : ''}
    ${arr(country.requisitos).length ? `<div class="mt-2">${listBlock(country.requisitos)}</div>` : ''}
    ${country.notas ? `<p class="tiny muted mt-2">${esc(country.notas)}</p>` : ''}
    <div class="between mt-2" style="align-items:flex-end;gap:6px;flex-wrap:wrap">
      <span class="tiny muted">${esc(arr(country.misiones).length ? `Misiones: ${country.misiones.join(' · ')}` : '')}</span>
      ${country.fuente && country.fuente_verificada ? sourceLink(country.fuente) : ''}
    </div>
  </div>`;
}

function learningCardHTML(item) {
  const mission = arr(S.state?.missions).find((m) => m.id === item.missionId);
  return `<div class="learning-card ${item.pinned ? 'pinned' : ''}">
    <div>
      <p class="learning-insight">${item.pinned ? `${icon('pin', 'icon-sm')} ` : ''}${esc(item.insight || '')}</p>
      ${item.evidence ? `<p class="learning-evidence"><b>Evidencia:</b> ${esc(item.evidence)}</p>` : ''}
      ${item.apply ? `<p class="learning-apply"><b>Aplicar:</b> ${esc(item.apply)}</p>` : ''}
      <div class="learning-meta">
        <span class="badge badge-neutral">${esc(item.tag || 'operacion')}</span>
        <span class="badge badge-${item.confidence === 'alta' ? 'ok' : item.confidence === 'baja' ? 'danger' : 'warn'}">Confianza ${esc(item.confidence || 'media')}</span>
        ${demoBadge(item.demo)}
        ${item.scope ? `<span class="tiny muted">${esc(item.scope)}</span>` : ''}
        ${mission ? `<a class="tiny" href="#/misiones/${encodeURIComponent(mission.id)}" style="color:var(--amber-deep);text-decoration:none">${esc(mission.name)}</a>` : ''}
      </div>
    </div>
    <div class="learning-actions">
      <button class="icon-btn sm ${item.pinned ? 'bordered' : ''}" type="button" data-action="toggle-learning" data-id="${attr(item.id)}" title="${item.pinned ? 'Quitar de fijados' : 'Fijar aprendizaje'}" aria-label="${item.pinned ? 'Quitar de fijados' : 'Fijar aprendizaje'}">${icon('pin')}</button>
      <button class="icon-btn sm danger" type="button" data-action="delete-learning" data-id="${attr(item.id)}" title="Eliminar aprendizaje" aria-label="Eliminar aprendizaje">${icon('trash')}</button>
    </div>
  </div>`;
}

function openLearningModal() {
  openModal({
    title: 'Agregar aprendizaje',
    subtitle: 'Solo lo que tenga evidencia. Una corazonada no es un aprendizaje.',
    body: `<form id="learning-form">
      <div class="form-grid">
        <div class="field full"><label for="lrn-insight">Qué aprendiste</label><textarea class="textarea" id="lrn-insight" name="insight" rows="3" required placeholder="Ej.: las tiendas pequeñas piden una unidad de muestra antes de comprometer 6."></textarea></div>
        <div class="field full"><label for="lrn-evidence">Evidencia</label><textarea class="textarea" id="lrn-evidence" name="evidence" rows="2" placeholder="Qué pasó, con quién, cuándo."></textarea></div>
        <div class="field full"><label for="lrn-apply">Cómo se aplica</label><textarea class="textarea" id="lrn-apply" name="apply" rows="2" placeholder="Qué cambia en la próxima misión."></textarea></div>
        <div class="field"><label for="lrn-tag">Etiqueta</label><select class="select" id="lrn-tag" name="tag">${LEARNING_TAGS.filter(([v]) => v !== 'todos').map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></div>
        <div class="field"><label for="lrn-confidence">Confianza</label><select class="select" id="lrn-confidence" name="confidence"><option value="alta">Alta</option><option value="media" selected>Media</option><option value="baja">Baja</option></select></div>
        <div class="field full"><label for="lrn-scope">Alcance</label><input class="input" id="lrn-scope" name="scope" value="${attr(S.state.brand?.name || 'General')}" placeholder="Marca, producto o mercado"></div>
      </div>
    </form>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="button" data-action="save-learning">${icon('check')} Guardar aprendizaje</button>`,
  });
}

async function saveLearning() {
  const form = $('#learning-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!String(data.insight || '').trim()) { toast('Escribí el aprendizaje.', 'error'); return; }
  try {
    await api('/api/learnings', { method: 'POST', body: data });
    closeModal();
    await loadState({ silent: true, render: false });
    render();
    toast('Aprendizaje guardado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function toggleLearning(id) {
  const item = arr(S.state.learnings).find((l) => l.id === id);
  if (!item) return;
  try {
    const result = await api(`/api/learnings/${encodeURIComponent(id)}`, { method: 'PATCH', body: { pinned: !item.pinned } });
    const index = arr(S.state.learnings).findIndex((l) => l.id === id);
    if (index >= 0) S.state.learnings[index] = result.item;
    render();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteLearning(id) {
  const confirmed = await confirmAction({
    title: 'Eliminar aprendizaje',
    message: '¿Borrar este aprendizaje de la memoria del equipo?',
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api(`/api/learnings/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadState({ silent: true, render: false });
    render();
    toast('Aprendizaje eliminado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function saveSuppression() {
  const form = document.getElementById('suppression-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const payload = {
    email: String(data.email || '').trim(),
    domain: String(data.domain || '').trim(),
    company: String(data.company || '').trim(),
    reason: String(data.reason || '').trim(),
    blockDomain: data.blockDomain === 'on',
  };
  if (!payload.email && !payload.domain && !payload.company) {
    toast('Indicá un email, un dominio o una empresa.', 'error');
    return;
  }
  try {
    await api('/api/suppressions', { method: 'POST', body: payload });
    await loadState({ silent: true, render: false });
    render();
    toast('Contacto agregado a la lista de no contactar.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteSuppression(id) {
  const confirmed = await confirmAction({
    title: 'Quitar de la lista',
    message: '¿Volver a permitir el contacto con esta persona o empresa? Solo hacelo si tenés una razón concreta.',
    confirmLabel: 'Quitar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    const result = await api(`/api/suppressions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadState({ silent: true, render: false });
    render();
    toast(result.released ? `Contacto habilitado. ${result.released} borrador(es) volvieron a revisión.` : 'Contacto quitado de la lista.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ─────────────────────────────────────────────────────────────
   18. Ajustes
   ───────────────────────────────────────────────────────────── */

const SETTINGS_TABS = [
  ['marca', 'Marca', 'sun'],
  ['ia', 'Inteligencia artificial', 'sparkles'],
  ['busqueda', 'Búsqueda y contactos', 'search'],
  ['correo', 'Correo', 'mail'],
  ['notificaciones', 'Notificaciones', 'message'],
  ['no-contactar', 'No contactar', 'shield'],
  ['misiones', 'Misiones', 'spark'],
  ['datos', 'Datos y respaldo', 'database'],
  ['ayuda', 'Ayuda', 'shield'],
];

const SEARCH_PROVIDERS = [
  ['duckduckgo', 'Web sin clave · SearXNG (mejor esfuerzo)'],
  ['tavily', 'Tavily'],
  ['brave', 'Brave Search'],
  ['serper', 'Serper (Google)'],
  ['none', 'Sin búsqueda web'],
];

const EMAIL_PROVIDERS = [
  ['manual', 'Manual · exportar .eml y marcar como enviado'],
  ['gmail', 'Gmail · envío real con contraseña de aplicación (recomendado)'],
  ['resend', 'Resend · envío real desde tu dominio verificado'],
  ['webhook', 'Webhook propio · Make, n8n o tu servidor'],
];

function currencyOptions(current = 'USD') {
  return [...new Set([...CURRENCIES, current].filter(Boolean))]
    .map((code) => `<option value="${attr(code)}" ${code === current ? 'selected' : ''}>${esc(code)}</option>`)
    .join('');
}

function settingsTabID() {
  const requested = S.route?.query?.get('tab');
  const fallback = S.ui.settingsTab || 'marca';
  const valid = (id) => SETTINGS_TABS.some(([tab]) => tab === id);
  const tab = valid(requested) ? requested : valid(fallback) ? fallback : 'marca';
  S.ui.settingsTab = tab;
  return tab;
}

function settingsPageHead() {
  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Ajustes</p>
      <h2 class="page-title">Tu sistema, tus reglas.</h2>
      <p class="page-sub">Todo vive en tu computadora. Conectá solo lo que quieras usar: Lucian funciona en modo demo sin una sola clave, y envía correos reales únicamente cuando vos lo confirmás.</p>
    </div>
    <div class="page-actions">
      <a class="btn btn-ghost btn-sm" href="#/ajustes?tab=ayuda">${icon('shield')} Ver ayuda</a>
    </div>
  </div>`;
}

function settingsStatusCard(title, ok, textLine, actions = '') {
  return `<div class="integration-card">
    <span class="status-dot ${ok ? 'ok' : 'muted'}"></span>
    <div style="flex:1;min-width:0">
      <h4>${esc(title)} · ${ok ? 'listo' : 'pendiente'}</h4>
      <p>${esc(textLine)}</p>
      ${actions ? `<div class="cluster mt-2">${actions}</div>` : ''}
    </div>
  </div>`;
}

function testButton(target, label = 'Probar conexión', iconName = 'refresh') {
  return `<button class="btn btn-ghost btn-sm" type="button" data-action="test-integration" data-target="${attr(target)}">${icon(iconName)} ${esc(label)}</button>`;
}

function testResultBox(target) {
  return `<div class="test-result" data-test-result="${attr(target)}" role="status" aria-live="polite"></div>`;
}

function settingsForm(tab, title, subtitle, body, note = '') {
  return `<form id="settings-form" class="settings-form" data-settings-tab="${attr(tab)}" autocomplete="off">
    <div class="form-section">
      <p class="form-section-title">${esc(title)}</p>
      <p class="form-section-sub">${esc(subtitle)}</p>
      ${body}
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" type="submit">${icon('check')} Guardar cambios</button>
      <button class="btn btn-ghost" type="button" data-action="ai-configure">${icon('wand')} Configurar con IA</button>
      <span class="form-note">${note}</span>
    </div>
  </form>`;
}

function settingsBrandHTML() {
  const brand = S.state.brand || {};
  const configured = Boolean(brand.name && brand.maker && brand.email);
  const body = `
    ${settingsStatusCard(
      'Identidad de la marca',
      configured,
      configured
        ? 'Los mensajes y el pie de los correos van a salir con tu nombre real.'
        : 'Completá al menos nombre, quién está detrás y un correo de contacto. Sin eso, el equipo escribe con datos genéricos.',
    )}
    <div class="form-grid">
      <div class="field"><label for="brand-name">Nombre de la marca <span class="req">*</span></label><input class="input" id="brand-name" name="brandName" value="${attr(brand.name || '')}" required placeholder="Lucian"></div>
      <div class="field"><label for="brand-maker">Quién está detrás</label><input class="input" id="brand-maker" name="brandMaker" value="${attr(brand.maker || '')}" placeholder="Tu nombre o el del taller"></div>
      <div class="field full"><label for="brand-tagline">Frase corta</label><input class="input" id="brand-tagline" name="brandTagline" value="${attr(brand.tagline || '')}" placeholder="Lámparas de diseño impresas en 3D"></div>
      <div class="field"><label for="brand-city">Ciudad</label><input class="input" id="brand-city" name="brandCity" value="${attr(brand.city || '')}" placeholder="Rosario"></div>
      <div class="field"><label for="brand-country">País</label><input class="input" id="brand-country" name="brandCountry" value="${attr(brand.country || '')}" placeholder="Argentina"></div>
      <div class="field"><label for="brand-website">Sitio web</label><input class="input" id="brand-website" name="brandWebsite" value="${attr(brand.website || '')}" placeholder="https://tumarca.com"></div>
      <div class="field"><label for="brand-instagram">Instagram</label><input class="input" id="brand-instagram" name="brandInstagram" value="${attr(brand.instagram || '')}" placeholder="@tumarca"></div>
      <div class="field"><label for="brand-email">Correo de contacto <span class="req">*</span></label><input class="input" id="brand-email" name="brandEmail" type="email" value="${attr(brand.email || '')}" placeholder="hola@tumarca.com"><p class="field-hint">También se usa como remitente si no configurás uno en Correo.</p></div>
      <div class="field"><label for="brand-currency">Moneda principal</label><select class="select" id="brand-currency" name="brandCurrency">${currencyOptions(brand.currency || 'USD')}</select></div>
      <div class="field full"><label for="brand-address">Dirección o ciudad de envío</label><input class="input" id="brand-address" name="brandAddress" value="${attr(brand.address || '')}" placeholder="Calle, número, código postal. Solo se usa en documentos."></div>
      <div class="field full"><label for="brand-languages">Idiomas para escribir</label><input class="input" id="brand-languages" name="brandLanguages" value="${attr(arr(brand.languages).join(', '))}" placeholder="es, en"><p class="field-hint">Separados por coma. Los mensajes a cada comprador se escriben en su idioma cuando el equipo lo sabe.</p></div>
    </div>`;
  return settingsForm('marca', 'Quién está detrás', 'Esta información se usa en los mensajes, el pie de cumplimiento y los documentos exportados.', body, 'Se guarda solo en tu computadora.');
}

function settingsAIHTML() {
  const settings = S.state.settings || {};
  const ai = settings.ai || {};
  const providers = arr(S.state.providers);
  const selected = providers.find((p) => p.id === ai.provider) || providers[0] || { id: ai.provider || 'openai', label: ai.provider || 'OpenAI', models: [], note: '' };
  const ready = Boolean(S.state.flags?.ai);
  const body = `
    ${settingsStatusCard(
      'Motor de IA',
      ready,
      ready
        ? `${selected.label || ai.provider} está configurado. Las misiones reales consumen tokens de tu cuenta.`
        : 'Sin una clave, Lucian funciona en modo demo con respuestas simuladas. El flujo es el mismo; los datos no.',
      testButton('ai', 'Probar conexión') + ` <button class="btn btn-ghost btn-sm" type="button" data-action="load-models">${icon('list' in ICON_PATHS ? 'list' : 'search')} Ver modelos</button>`,
    )}
    <div class="form-grid">
      <div class="field full"><label for="ai-provider">Proveedor</label><select class="select" id="ai-provider" name="provider">${providers.map((p) => `<option value="${attr(p.id)}" ${p.id === ai.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select><p class="field-hint" id="ai-provider-note">${esc(selected.note || '')}</p></div>
      <div class="field full"><label for="ai-key">Clave de API</label>
        <div class="secret-row">
          <input class="input" id="ai-key" name="apiKey" type="password" value="${attr(ai.apiKey || '')}" placeholder="Pegá tu clave acá" autocomplete="new-password">
          <button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="ai.apiKey">Borrar</button>
        </div>
        <p class="field-hint">Las claves se guardan en texto plano en tu carpeta de datos. Si ya hay una, ves solo los últimos cuatro caracteres: dejá el campo como está para conservarla. ${selected.keyUrl ? `<a href="${attr(safeUrl(selected.keyUrl))}" target="_blank" rel="noopener noreferrer" id="ai-key-link">Conseguir una clave ${icon('external', 'icon-sm')}</a>` : '<span id="ai-key-link"></span>'}</p>
      </div>
      <div class="field full"><label for="ai-base">Dirección del servicio (base URL)</label><input class="input" id="ai-base" name="baseUrl" value="${attr(ai.baseUrl || selected.baseUrl || '')}" placeholder="https://api.openai.com/v1"><p class="field-hint">Para OpenAI, OpenRouter, Gemini, Groq, DeepSeek, Mistral, Ollama o cualquier servidor compatible con OpenAI.</p></div>
      <div class="field"><label for="ai-model">Modelo de texto</label><input class="input" id="ai-model" name="model" value="${attr(typeof ai.model === 'string' ? ai.model : (ai.model?.id || ''))}" list="ai-model-list" placeholder="${attr(typeof selected.model === 'string' ? selected.model : (selected.model?.id || 'nombre-del-modelo'))}"><datalist id="ai-model-list">${arr(selected.models).map((m) => { const id = typeof m === 'string' ? m : (m.id || m.name || m.model || ''); return `<option value="${attr(id)}">`; }).join('')}</datalist></div>
      <div class="field"><label for="ai-vision">Modelo con visión (opcional)</label><input class="input" id="ai-vision" name="visionModel" value="${attr(ai.visionModel || '')}" placeholder="Se usa para leer fotos de producto"><p class="field-hint">Si tu modelo principal no ve imágenes, indicá uno que sí. Si no, el equipo trabaja con el texto y las notas.</p></div>
      <div class="field"><label for="ai-temp">Creatividad</label><div class="range-row"><input type="range" id="ai-temp" name="temperature" min="0" max="1.2" step="0.1" value="${attr(ai.temperature ?? 0.6)}"><span class="range-value" id="ai-temp-value">${esc(ai.temperature ?? 0.6)}</span></div><p class="field-hint">Baja para precios y aduanas; más alta para narrativa y contenido.</p></div>
      <div class="field"><label for="ai-max">Máximo de tokens por respuesta</label><input class="input" id="ai-max" name="maxTokens" type="number" min="512" max="16000" step="128" value="${attr(ai.maxTokens ?? 8192)}"><p class="field-hint">Más tokens = respuestas más largas y mayor costo. Los pasos largos (red team, plan) necesitan 8000 o más; si el modelo corta el JSON, Lucian amplía el límite sola y reintenta.</p></div>
    </div>
    ${testResultBox('ai')}
    <div class="cluster mt-3" id="ai-models"></div>
    <div class="artifact-callout info mt-3"><b>Qué se paga y qué no</b>Lucian es gratis y corre en tu máquina. Solo pagás el proveedor de IA que elijas, y únicamente cuando lanzás una misión real o hacés una prueba de conexión.</div>`;
  return settingsForm('ia', 'El motor que piensa', 'Elegí un proveedor y pegá una clave. El modo demo no necesita nada de esto.', body, 'La prueba de conexión hace una llamada real y puede tener un costo mínimo.');
}

function settingsSearchHTML() {
  const settings = S.state.settings || {};
  const search = settings.search || {};
  const hunter = settings.hunter || {};
  const flags = S.state.flags || {};
  const body = `
    ${settingsStatusCard(
      'Búsqueda web',
      Boolean(flags.search),
      search.provider === 'duckduckgo'
        ? 'Sin clave: Lucian usa instancias públicas de SearXNG (y DuckDuckGo como último recurso). Si una consulta falla, lo dice y no inventa resultados.'
        : search.provider === 'none'
          ? 'La búsqueda está apagada. El equipo solo usará lo que ya sabés y tus datos.'
          : flags.search
            ? 'El proveedor está configurado y es la opción más estable.'
            : 'Falta la clave del proveedor elegido.',
      testButton('search', 'Probar búsqueda', 'search'),
    )}
    <div class="form-grid">
      <div class="field full"><label for="search-provider">Proveedor de búsqueda</label><select class="select" id="search-provider" name="searchProvider">${SEARCH_PROVIDERS.map(([value, label]) => `<option value="${value}" ${search.provider === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><p class="field-hint">Sin clave no hay garantía de resultados: los motores públicos limitan consultas. Para misiones que tienen que vender en serio, configurá Tavily, Brave o Serper (tienen capa gratuita) o una instancia propia de SearXNG.</p></div>
      <div class="field full"><label for="search-key">Clave del proveedor (si corresponde)</label><div class="secret-row"><input class="input" id="search-key" name="searchApiKey" type="password" value="${attr(search.apiKey || '')}" placeholder="Solo para Tavily, Brave o Serper" autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="search.apiKey">Borrar</button></div></div>
      <div class="field full"><label for="search-searx">Instancia SearXNG propia (opcional)</label><input class="input" id="search-searx" name="searxUrl" value="${attr(search.searxUrl || '')}" placeholder="https://searx.tu-dominio.com"><p class="field-hint">Se consulta antes que las instancias públicas. Sirve para que la búsqueda no dependa de terceros.</p></div>
      <div class="field"><label for="search-results">Resultados por consulta</label><input class="input" id="search-results" name="maxResults" type="number" min="1" max="10" step="1" value="${attr(search.maxResults || 8)}"><p class="field-hint">Más resultados = más contexto y más tiempo.</p></div>
      <div class="field"><label for="search-depth">Profundidad de prospeccion</label><select class="input" id="search-depth" name="prospectingDepth"><option value="advanced" ${search.prospectingDepth !== 'basic' ? 'selected' : ''}>Avanzada (recomendado)</option><option value="basic" ${search.prospectingDepth === 'basic' ? 'selected' : ''}>Basica (menos creditos)</option></select></div>
    </div>
    ${testResultBox('search')}

    <div class="form-section">
      <p class="form-section-title">Verificación de contactos</p>
      <p class="form-section-sub">Hunter es opcional. Sin Hunter, Lucian busca correos públicos en los sitios que encuentra y nunca inventa direcciones.</p>
      ${settingsStatusCard(
        'Hunter.io',
        Boolean(flags.hunter),
        flags.hunter ? 'La verificación de correos está disponible.' : 'Opcional. Podés trabajar sin esto; el equipo solo usará correos públicos y verificados a mano.',
        testButton('hunter', 'Probar Hunter'),
      )}
      <div class="form-grid">
        <div class="field full"><label class="switch"><input type="checkbox" name="hunterEnabled" ${hunter.enabled ? 'checked' : ''}><span class="track"></span><span>Usar Hunter para verificar y descubrir correos</span></label></div>
        <div class="field full"><label for="hunter-key">Clave de Hunter</label><div class="secret-row"><input class="input" id="hunter-key" name="hunterApiKey" type="password" value="${attr(hunter.apiKey || '')}" placeholder="Tu clave de hunter.io" autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="hunter.apiKey">Borrar</button></div></div>
      </div>
      ${testResultBox('hunter')}
    </div>`;
  return settingsForm('busqueda', 'Investigar sin inventar', 'La búsqueda alimenta al analista de mercado y al cazador de compradores. Los correos se verifican antes de usarse.', body, 'La prueba de búsqueda consulta la web real.');
}

function settingsEmailHTML() {
  const settings = S.state.settings || {};
  const email = settings.email || {};
  const brand = S.state.brand || {};
  const limits = S.state.limits || {};
  const configured = Boolean(S.state.flags?.email) || Boolean(email.webhookUrl);
  const body = `
    ${settingsStatusCard(
      'Envío desde Lucian',
      configured,
      configured
        ? `${email.provider === 'resend' ? 'Resend' : 'Webhook'} está configurado. Lucian nunca envía sin tu confirmación y respeta el límite diario.`
        : 'Modo manual: preparás el mensaje, descargás el .eml o lo copiás, y lo enviás desde tu correo. Nada sale solo.',
      testButton('resend', 'Probar Resend', 'send') + ` ${testButton('email', 'Revisar configuración', 'check')}`,
    )}
    <div class="form-grid">
      <div class="field full"><label for="email-provider">Cómo se envían los correos</label><select class="select" id="email-provider" name="emailProvider">${EMAIL_PROVIDERS.map(([value, label]) => `<option value="${value}" ${email.provider === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><p class="field-hint">Manual es la opción más segura para empezar. Resend requiere un dominio verificado. El webhook es para quien ya tiene Make, n8n o un servidor propio.</p></div>
      <div class="field full"><label for="email-smtp-user">Usuario de Gmail</label><input class="input" id="email-smtp-user" name="smtpUser" value="${attr(email.smtpUser || '')}" placeholder="tuemail@gmail.com"><p class="field-hint">Tu correo de Gmail. Se usa para conectarse al servidor SMTP de Gmail.</p></div>
      <div class="field full"><label for="email-smtp-pass">Contraseña de aplicación de Gmail</label><div class="secret-row"><input class="input" id="email-smtp-pass" name="smtpPassword" type="password" value="${attr(email.smtpPassword || '')}" placeholder="16 letras (contraseña de aplicación)" autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="email.smtpPassword">Borrar</button></div><p class="field-hint">No es tu contraseña normal. La generás en myaccount.google.com/apppasswords (16 letras, con o sin espacios). Con esto Lucian envía correos reales desde Gmail.</p></div>
      <div class="field"><label for="email-from">Remitente</label><input class="input" id="email-from" name="from" value="${attr(email.from || '')}" placeholder="${attr(brand.email ? `${brand.name || 'Lucian'} <${brand.email}>` : 'Tu nombre <hola@tumarca.com>')}"><p class="field-hint">Nombre y correo. Con Gmail debe ser tu dirección de Gmail.</p></div>
      <div class="field"><label for="email-reply">Responder a</label><input class="input" id="email-reply" name="replyTo" value="${attr(email.replyTo || '')}" placeholder="Opcional"></div>
      <div class="field full"><label for="email-resend">Clave de Resend</label><div class="secret-row"><input class="input" id="email-resend" name="resendKey" type="password" value="${attr(email.resendKey || '')}" placeholder="re_..." autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="email.resendKey">Borrar</button></div></div>
      <div class="field full"><label for="email-webhook">Webhook de envío</label><input class="input" id="email-webhook" name="webhookUrl" value="${attr(email.webhookUrl || '')}" placeholder="https://tu-servidor.com/enviar"><p class="field-hint">Lucian manda el mensaje a esta URL y tu automatización hace el envío final.</p></div>
      <div class="field full"><label for="email-webhook-token">Token para correos entrantes</label><div class="secret-row"><input class="input" id="email-webhook-token" name="webhookToken" type="password" value="${attr(email.webhookToken || '')}" placeholder="Una frase larga y secreta" autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="email.webhookToken">Borrar</button></div><p class="field-hint">Protege <code>/api/webhooks/email</code>. Si no hay token, Lucian solo acepta correos entrantes desde esta computadora. Para recibir respuestas desde internet, configurá uno acá o en <code>LUCIAN_WEBHOOK_TOKEN</code>.</p></div>
      <div class="field"><label for="email-limit">Límite diario</label><input class="input" id="email-limit" name="dailyLimit" type="number" min="1" max="200" value="${attr(email.dailyLimit || 20)}"><p class="field-hint">Hoy: ${num(limits.used)} de ${num(limits.limit || email.dailyLimit || 20)}${limits.warmup ? ` · calentamiento, día ${num(limits.day)}` : ''}.</p></div>
      <div class="field"><label class="switch" style="margin-top:24px"><input type="checkbox" name="warmup" ${email.warmup ? 'checked' : ''}><span class="track"></span><span>Calentamiento gradual</span></label><p class="field-hint">Empieza con pocos envíos por día y sube de a poco. Mejor reputación, menos spam.</p></div>
      <div class="field full"><label for="email-footer">Pie de cumplimiento</label><textarea class="textarea" id="email-footer" name="footer" rows="4" placeholder="Ej.: Recibís este correo porque tu tienda trabaja con diseño. Podés responder “baja” para no recibir más.">${esc(email.footer || '')}</textarea><p class="field-hint">Se agrega al final de cada correo. Lucian ya incluye la baja y tu identidad (marca, dirección y web).</p></div>
    </div>

    <div class="form-section">
      <p class="form-section-title">Piloto automático · opcional</p>
      <p class="form-section-sub">Cuando lo activás, Lucian envía solo los borradores que ya pasaron cumplimiento y red team, respetando el límite diario y el calentamiento. Si algo no cuadra, ese mensaje se detiene y te avisa.</p>
      <div class="form-grid">
        <div class="field full"><label class="switch"><input type="checkbox" name="emailAutopilot" ${email.autopilot ? 'checked' : ''}><span class="track"></span><span>Enviar automáticamente los borradores listos</span></label><p class="field-hint">Requiere Resend o webhook. En modo manual no se activa: marcar como enviado sin enviar sería un engaño.</p></div>
        <div class="field"><label for="email-spacing">Minutos entre envíos</label><input class="input" id="email-spacing" name="autopilotSpacingMin" type="number" min="1" max="120" value="${attr(email.autopilotSpacingMin || 5)}"><p class="field-hint">Un ritmo humano reduce el riesgo de spam.</p></div>
        <div class="field"><label class="switch" style="margin-top:24px"><input type="checkbox" name="emailFollowUps" ${email.followUps !== false ? 'checked' : ''}><span class="track"></span><span>Preparar seguimientos</span></label><p class="field-hint">Día 4 y día 10. Se detienen si hay respuesta o baja.</p></div>
        <div class="field"><label class="switch" style="margin-top:24px"><input type="checkbox" name="emailPostSales" ${email.postSales !== false ? 'checked' : ''}><span class="track"></span><span>Postventa (fidelización)</span></label><p class="field-hint">Al marcar ganado: agradecimiento al día 3, feedback al día 30 y reorden al día 90. Sin piloto quedan “Por aprobar”.</p></div>
      </div>
      ${S.state.outbox?.enabled ? `<div class="artifact-callout mt-2"><b>Cola de salida</b>${num(S.state.outbox.pending)} pendiente${num(S.state.outbox.pending) === 1 ? '' : 's'} · ${num(S.state.outbox.sent)} enviado${num(S.state.outbox.sent) === 1 ? '' : 's'}${S.state.outbox.nextAt ? ` · próximo ${new Date(S.state.outbox.nextAt).toLocaleString()}` : ''}.</div>` : ''}
    </div>

    <div class="form-section">
      <p class="form-section-title">Cobros y cotizaciones</p>
      <p class="form-section-sub">Una cotización clara y un link de pago convierten el interés en un pedido. Cada producto puede tener su propio link; este es el que se usa cuando no lo tiene.</p>
      <div class="form-grid">
        <div class="field full"><label for="sales-payment">Link de pago global</label><input class="input" id="sales-payment" name="salesPaymentLink" type="url" value="${attr(settings.sales?.paymentLink || '')}" placeholder="https://link.mercadopago.com.ar/”¦ o https://buy.stripe.com/”¦"><p class="field-hint">Se incluye en la cotización. Si está vacío, el correo pide confirmación y el link se envía después.</p></div>
        <div class="field"><label for="sales-validity">Validez de la cotización (días)</label><input class="input" id="sales-validity" name="salesQuoteValidityDays" type="number" min="1" max="120" value="${attr(settings.sales?.quoteValidityDays || 15)}"></div>
      </div>
    </div>
    ${testResultBox('resend')}
    ${testResultBox('email')}
    <div class="artifact-callout ${email.autopilot ? 'warn' : ''} mt-3"><b>${email.autopilot ? 'El piloto automático está activo' : 'Nada se envía solo'}</b>${email.autopilot ? 'Solo salen borradores aprobados por las guardas, con cupo y pausas. Podés apagarlo en cualquier momento.' : 'Cada mensaje pasa por tu revisión. Los contactos de ejemplo terminan en example.com y están bloqueados para envíos reales.'}</div>`;
  return settingsForm('correo', 'Cómo salen los mensajes', 'Empezá en manual. Cuando tengas dominio propio y confianza, conectá Resend o tu webhook.', body, 'El límite diario y el calentamiento se aplican a los envíos reales.');
}

function settingsNotifyHTML() {
  const settings = S.state.settings || {};
  const notify = settings.notify || {};
  const telegram = notify.telegram || {};
  const whatsapp = notify.whatsapp || {};
  const events = notify.events || {};
  const body = `
    <div class="form-grid">
      <div class="field full"><label class="switch"><input type="checkbox" name="notifyPaused" ${notify.paused ? 'checked' : ''}><span class="track"></span><span>Pausar todas las notificaciones</span></label><p class="field-hint">Lucian sigue trabajando; solo deja de mandarte mensajes.</p></div>
    </div>

    <div class="form-section">
      <p class="form-section-title">Telegram · el canal más simple</p>
      <p class="form-section-sub">Un bot propio te avisa cuando una misión termina, cuando hay una respuesta caliente y cuando un paso falla. También podés responderle al bot.</p>
      ${settingsStatusCard(
        'Telegram',
        Boolean(S.state.flags?.telegram),
        S.state.flags?.telegram ? 'El bot está listo para avisarte.' : 'Creá un bot con @BotFather, pegá el token y elegí el chat.',
        testButton('telegram', 'Enviar prueba', 'send') + ` <button class="btn btn-ghost btn-sm" type="button" data-action="find-chats">${icon('users')} Buscar chats</button>`,
      )}
      <div class="form-grid">
        <div class="field full"><label class="switch"><input type="checkbox" name="telegramEnabled" ${telegram.enabled ? 'checked' : ''}><span class="track"></span><span>Activar Telegram</span></label></div>
        <div class="field full"><label for="tg-token">Token del bot</label><div class="secret-row"><input class="input" id="tg-token" name="tgToken" type="password" value="${attr(telegram.token || '')}" placeholder="123456789:AA..." autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="notify.telegram.token">Borrar</button></div></div>
        <div class="field"><label for="tg-chat">Chat o usuario</label><input class="input" id="tg-chat" name="tgChat" value="${attr(telegram.chatId || '')}" placeholder="Tu chat ID numérico"><p class="field-hint">Si no lo sabés, guardá el token, escribile al bot y usá “Buscar chats”.</p></div>
        <div class="field"><label for="tg-digest">Hora del resumen diario</label><input class="input" id="tg-digest" name="tgDigest" type="number" min="0" max="23" value="${attr(telegram.digestHour ?? 9)}"><p class="field-hint">Hora local de tu computadora.</p></div>
      </div>
      ${testResultBox('telegram')}
      <div class="cluster mt-2" id="telegram-chats"></div>
    </div>

    <div class="form-section">
      <p class="form-section-title">WhatsApp Cloud API · opcional</p>
      <p class="form-section-sub">Requiere una cuenta de Meta, un número dedicado y un webhook público. Si no tenés eso, Telegram es una mejor primera opción.</p>
      ${settingsStatusCard(
        'WhatsApp',
        Boolean(S.state.flags?.whatsapp),
        S.state.flags?.whatsapp ? 'El canal está configurado para avisarte y recibir respuestas.' : 'Sin configurar. No es necesario para usar Lucian.',
        testButton('whatsapp', 'Enviar prueba', 'send'),
      )}
      <div class="form-grid">
        <div class="field full"><label class="switch"><input type="checkbox" name="whatsappEnabled" ${whatsapp.enabled ? 'checked' : ''}><span class="track"></span><span>Activar WhatsApp</span></label></div>
        <div class="field full"><label for="wa-token">Token permanente</label><div class="secret-row"><input class="input" id="wa-token" name="waToken" type="password" value="${attr(whatsapp.token || '')}" placeholder="Token de Meta" autocomplete="new-password"><button class="btn btn-ghost btn-sm" type="button" data-action="clear-secret" data-path="notify.whatsapp.token">Borrar</button></div></div>
        <div class="field"><label for="wa-phone">Phone Number ID</label><input class="input" id="wa-phone" name="waPhoneId" value="${attr(whatsapp.phoneNumberId || '')}" placeholder="ID del número en Meta"></div>
        <div class="field"><label for="wa-to">Tu WhatsApp</label><input class="input" id="wa-to" name="waTo" value="${attr(whatsapp.to || '')}" placeholder="5491123456789"><p class="field-hint">Código de país + número, sin espacios ni “+”.</p></div>
        <div class="field"><label for="wa-verify">Token de verificación del webhook</label><input class="input" id="wa-verify" name="waVerify" value="${attr(whatsapp.verifyToken || 'lucian')}" placeholder="lucian"></div>
        <div class="field"><label for="wa-version">Versión de la API</label><input class="input" id="wa-version" name="waVersion" value="${attr(whatsapp.apiVersion || 'v23.0')}" placeholder="v23.0"></div>
        <div class="field full"><label>URL del webhook para Meta</label><div class="field-row"><input class="input" readonly value="${attr(`${location.origin}/api/webhooks/whatsapp`)}"><button class="btn btn-ghost btn-sm" type="button" data-action="copy-webhook">${icon('copy')} Copiar</button></div><p class="field-hint">Esta dirección solo funciona si exponés Lucian en internet con HTTPS.</p></div>
      </div>
      ${testResultBox('whatsapp')}
    </div>

    <div class="form-section">
      <p class="form-section-title">Qué te avisa</p>
      <div class="form-grid">
        <div class="field"><label class="switch"><input type="checkbox" name="eventMissionDone" ${events.missionDone ? 'checked' : ''}><span class="track"></span><span>Misión terminada</span></label></div>
        <div class="field"><label class="switch"><input type="checkbox" name="eventMissionError" ${events.missionError ? 'checked' : ''}><span class="track"></span><span>Misión con error</span></label></div>
        <div class="field"><label class="switch"><input type="checkbox" name="eventMissionWarning" ${events.missionWarning ? 'checked' : ''}><span class="track"></span><span>Misión con avisos</span></label></div>
        <div class="field"><label class="switch"><input type="checkbox" name="eventHotReply" ${events.hotReply ? 'checked' : ''}><span class="track"></span><span>Respuesta caliente</span></label></div>
        <div class="field"><label class="switch"><input type="checkbox" name="eventOptOut" ${events.optOut ? 'checked' : ''}><span class="track"></span><span>Pidió la baja</span></label></div>
        <div class="field"><label class="switch"><input type="checkbox" name="eventDigest" ${events.digest ? 'checked' : ''}><span class="track"></span><span>Resumen diario</span></label></div>
      </div>
    </div>`;
  return settingsForm('notificaciones', 'Avisos sin ruido', 'Solo las señales que importan: una misión lista, una respuesta con interés o algo que se rompió.', body, 'Las pruebas de Telegram y WhatsApp envían un mensaje real.');
}

function settingsMissionHTML() {
  const settings = S.state.settings || {};
  const mission = settings.mission || {};
  const body = `
    ${settingsStatusCard(
      'Modo de trabajo',
      Boolean(S.state.flags?.ai),
      S.state.flags?.ai ? 'Hay una IA configurada. Las misiones nuevas pueden correr con datos reales.' : 'Sin IA, las misiones corren en demo. Podés cambiar la profundidad y los mercados igual.',
      S.state.flags?.ai ? '' : `<a class="btn btn-ghost btn-sm" href="#/ajustes?tab=ia">${icon('key')} Configurar IA</a>`,
    )}
    <div class="form-grid">
      <div class="field full"><label for="mission-depth">Profundidad por defecto</label><select class="select" id="mission-depth" name="missionDepth">${Object.entries(DEPTHS).map(([id, d]) => `<option value="${id}" ${mission.depth === id ? 'selected' : ''}>${esc(d.label)} · ${d.steps} pasos · ${esc(d.minutes)} min</option>`).join('')}</select><p class="field-hint">Rápida para probar. Estándar para vender. Profunda cuando hay una decisión importante.</p></div>
      <div class="field full"><label for="mission-markets">Mercados por defecto</label><input class="input" id="mission-markets" name="missionMarkets" value="${attr(arr(mission.markets).join(', '))}" placeholder="España, México, Estados Unidos"><p class="field-hint">Separados por coma. Dos o tres mercados ya es ambicioso para una persona sola.</p></div>
      <div class="field full"><label for="mission-tone">Tono de los mensajes</label><input class="input" id="mission-tone" name="missionTone" value="${attr(mission.tone || TONES[0])}" list="settings-tone-list"><datalist id="settings-tone-list">${TONES.map((t) => `<option value="${attr(t)}">`).join('')}</datalist></div>
      <div class="field"><label for="mission-max">Compradores por misión</label><input class="input" id="mission-max" name="missionMaxProspects" type="number" min="1" max="40" value="${attr(mission.maxProspects || 12)}"></div>
      <div class="field"><label for="mission-currency">Moneda de trabajo</label><select class="select" id="mission-currency" name="missionCurrency">${currencyOptions(mission.currency || 'USD')}</select></div>
      <div class="field"><label class="switch" style="margin-top:22px"><input type="checkbox" name="autoCreateThreads" ${mission.autoCreateThreads !== false ? 'checked' : ''}><span class="track"></span><span>Crear conversaciones en la bandeja</span></label></div>
      <div class="field"><label class="switch" style="margin-top:22px"><input type="checkbox" name="reviewDirectory" ${mission.reviewDirectory !== false ? 'checked' : ''}><span class="track"></span><span>Revisar compradores del directorio antes de enviar</span></label></div>
      <div class="field"><label class="switch" style="margin-top:22px"><input type="checkbox" name="researchPages" ${mission.researchPages !== false ? 'checked' : ''}><span class="track"></span><span>Leer páginas encontradas</span></label></div>
    </div>
    <div class="artifact-callout info mt-3"><b>Una misión no es una campaña</b>Cada misión es una pasada completa con un objetivo. Después podés repetirla con otra lámpara o ajustar el rumbo con lo que aprendió el equipo.</div>`;
  return settingsForm('misiones', 'Cómo trabaja el equipo', 'Estos valores vienen precargados en el asistente de nueva misión y podés cambiarlos en cada una.', body, 'No cambia misiones que ya están en curso.');
}

function settingsSuppressionsHTML() {
  const list = arr(S.state.suppressions);
  const rows = list.map((item) => `<div class="data-card" style="margin:0">
    <div style="min-width:0">
      <h4>${esc(item.company || item.email || item.domain || 'Contacto')}</h4>
      <p>${[item.email, item.domain, item.reason].filter(Boolean).map(esc).join(' · ') || 'Sin detalle'}</p>
      <p class="tiny muted" style="margin-top:3px">Agregado ${esc(dateShort(item.createdAt))}${item.source ? ` · ${esc(item.source)}` : ''}</p>
    </div>
    <button class="btn btn-ghost btn-sm" type="button" data-action="delete-suppression" data-id="${attr(item.id)}">${icon('trash')} Quitar</button>
  </div>`).join('');
  return `<div class="settings-form">
    <div class="form-section">
      <p class="form-section-title">Lista de no contactar</p>
      <p class="form-section-sub">Si alguien pide la baja, agregalo acá. Lucian no vuelve a escribirle en ninguna misión futura y bloquea los borradores pendientes de ese contacto.</p>
      <form id="suppression-form" class="form-grid" autocomplete="off">
        <div class="field"><label for="sup-email">Email exacto</label><input class="input" id="sup-email" name="email" type="email" placeholder="compras@tienda.com"></div>
        <div class="field"><label for="sup-domain">Dominio</label><input class="input" id="sup-domain" name="domain" placeholder="tienda.com"></div>
        <div class="field"><label for="sup-company">Empresa</label><input class="input" id="sup-company" name="company" placeholder="Nombre de la tienda"></div>
        <div class="field"><label for="sup-reason">Motivo</label><input class="input" id="sup-reason" name="reason" placeholder="Respondió BAJA / no quiere recibir más"></div>
        <div class="field full"><label class="checkbox"><input type="checkbox" name="blockDomain"><span>Bloquear todo el dominio del email</span></label><p class="field-hint">Por defecto un email bloquea solo esa dirección. Marcá esta opción si querés bloquear a toda la empresa (no se puede con Gmail/Outlook ni dominios compartidos).</p></div>
        <div class="form-actions" style="grid-column:1/-1;margin-top:2px">
          <button class="btn btn-primary btn-sm" type="submit">${icon('plus')} Agregar a la lista</button>
          <span class="form-note">Con un email alcanza. El campo “Dominio” se usa para bloquear una empresa por su dominio, sin cargar un email.</span>
        </div>
      </form>
    </div>
    <div class="form-section">
      <p class="form-section-title">${list.length ? `${list.length} contacto${list.length === 1 ? '' : 's'} bloqueado${list.length === 1 ? '' : 's'}` : 'Todavía no hay contactos bloqueados'}</p>
      ${list.length ? `<div class="stack">${rows}</div>` : '<div class="artifact-callout info"><b>Sin bloqueos</b>Cuando alguien responda “BAJA” o “no me escribas más”, Lucian lo detecta en la bandeja y lo agrega automáticamente.</div>'}
    </div>
  </div>`;
}

function settingsDataHTML() {
  const counts = S.state.counts || {};
  const app = S.state.app || {};
  const dataDir = app.dataDir || 'lucian/data';
  const demoLoaded = Boolean(S.state.onboarding?.demoLoaded);
  const body = `
    <div class="data-card">
      <div><h4>Copia de seguridad completa</h4><p>Productos, misiones, conversaciones, contenido, aprendizajes, ajustes y fotos en un ZIP. Incluye las claves en texto plano: guardalo en un lugar privado.</p></div>
      <a class="btn btn-primary btn-sm" href="/api/backup" download>${icon('download')} Descargar copia</a>
      <a class="btn btn-ghost btn-sm" href="/api/backup?safe=1" download>${icon('download')} Descargar copia sin claves</a>
    </div>
    <div class="data-card">
      <div><h4>Restaurar una copia</h4><p>Reemplaza los datos actuales por los del archivo. No se puede restaurar mientras hay una misión en curso.</p></div>
      <div class="cluster">
        <input class="file-input" id="restore-input" type="file" accept=".zip,.json,application/zip,application/json">
        <button class="btn btn-ghost btn-sm" type="button" data-action="restore-backup">${icon('upload')} Elegir archivo</button>
      </div>
    </div>
    <div class="form-section">
      <p class="form-section-title">Exportar sin formato propietario</p>
      <div class="form-grid">
        <div class="data-card" style="margin:0"><div><h4>Productos · CSV</h4><p>Código, nombre, precio, costo y estado.</p></div><a class="btn btn-ghost btn-sm" href="/api/export/products.csv" download>${icon('download')} Descargar</a></div>
        <div class="data-card" style="margin:0"><div><h4>Conversaciones · CSV</h4><p>Empresa, contacto, email, etapa y siguiente paso.</p></div><a class="btn btn-ghost btn-sm" href="/api/export/threads.csv" download>${icon('download')} Descargar</a></div>
      </div>
    </div>
    <div class="form-section">
      <p class="form-section-title">Datos de ejemplo</p>
      <p class="form-section-sub">Los ejemplos están marcados como demo. No se envían correos reales a sus direcciones example.com y podés borrarlos sin tocar tus datos.</p>
      <div class="data-card ${demoLoaded ? 'danger-zone' : ''}">
        <div><h4>${demoLoaded ? 'Hay datos de ejemplo cargados' : 'Sin datos de ejemplo'}</h4><p>${demoLoaded ? 'Podés borrarlos en cualquier momento. Tus productos y conversaciones reales no se tocan.' : 'Cargalos para recorrer el sistema completo sin configurar nada.'}</p></div>
        <div class="cluster">
          <button class="btn btn-ghost btn-sm" type="button" data-action="demo-seed">${icon('sun')} ${demoLoaded ? 'Recargar ejemplos' : 'Cargar ejemplos'}</button>
          ${demoLoaded ? `<button class="btn btn-danger btn-sm" type="button" data-action="clear-demo">${icon('trash')} Borrar ejemplos</button>` : ''}
        </div>
      </div>
    </div>
    <div class="form-section">
      <p class="form-section-title">Dónde vive todo</p>
      <div class="field-row"><input class="input" readonly value="${attr(dataDir)}"><button class="btn btn-ghost btn-sm" type="button" data-action="copy-el" data-target="data-dir-copy">${icon('copy')} Copiar</button></div>
      <textarea id="data-dir-copy" class="sr-only" readonly>${esc(dataDir)}</textarea>
      <p class="field-hint">Esta carpeta contiene JSON y fotos. Podés copiarla a otra computadora. No la edites a mano mientras Lucian está abierto.</p>
      <div class="kv-list mt-3">
        <div class="kv"><span>Productos</span><b>${num(counts.products)}</b></div>
        <div class="kv"><span>Misiones</span><b>${num(counts.missions)}</b></div>
        <div class="kv"><span>Conversaciones</span><b>${num(counts.threads)}</b></div>
        <div class="kv"><span>Contenido</span><b>${num(counts.content)}</b></div>
        <div class="kv"><span>Aprendizajes</span><b>${num(counts.learnings)}</b></div>
        <div class="kv"><span>No contactar</span><b>${num(counts.suppressions)}</b></div>
        <div class="kv"><span>Versión</span><b>v${esc(app.version || '1.0')}</b></div>
      </div>
    </div>
    <div class="artifact-callout danger mt-3"><b>Antes de borrar</b>No hay papelera. Si algo importa, descargá una copia primero. El borrado de ejemplos solo elimina registros marcados como demo.</div>`;
  return `<div class="settings-form">
    <div class="form-section"><p class="form-section-title">Tus datos, en tu carpeta</p><p class="form-section-sub">Sin nube obligatoria, sin Airtable y sin Make. Una copia completa te deja dormir tranquilo.</p></div>
    ${body}
  </div>`;
}

function settingsHelpHTML() {
  const flags = S.state.flags || {};
  const brand = S.state.brand || {};
  const checks = [
    ['Marca con nombre y correo', Boolean(brand.name && brand.email), 'Se usa en los mensajes y en el pie de los correos.', '#/ajustes?tab=marca'],
    ['Motor de IA', Boolean(flags.ai), flags.ai ? 'Las misiones pueden correr con datos reales.' : 'Sin IA, todo funciona en demo. Podés practicar igual.', '#/ajustes?tab=ia'],
    ['Búsqueda web', Boolean(flags.search), 'Sin clave usa SearXNG público; para ventas en serio, configurá Tavily, Brave o Serper.', '#/ajustes?tab=busqueda'],
    ['Remitente de correo', Boolean(S.state.settings?.email?.from || brand.email), 'Necesario para descargar el .eml y para Resend.', '#/ajustes?tab=correo'],
    ['Telegram', Boolean(flags.telegram), 'Opcional, pero es la forma más simple de recibir avisos.', '#/ajustes?tab=notificaciones'],
  ];
  const body = `
    <div class="artifact-grid-2">
      <div class="artifact-card"><h5>1 · Cargá una lámpara</h5><p>Fotos, precio, costo, medidas y notas. Cuanto mejor sea el contexto, mejor escribe el equipo.</p></div>
      <div class="artifact-card"><h5>2 · Lanzá una misión</h5><p>Elegí el objetivo, los mercados y la profundidad. En modo demo no necesitás ninguna clave.</p></div>
      <div class="artifact-card"><h5>3 · Revisá y enviá</h5><p>La misión deja borradores en la bandeja. Leelos, editalos y confirmá qué se envía. Nada sale solo.</p></div>
      <div class="artifact-card"><h5>4 · Aprendé</h5><p>Cada misión deja aprendizajes y fuentes. La próxima no empieza de cero.</p></div>
    </div>
    <div class="form-section">
      <p class="form-section-title">Tu configuración</p>
      <div class="stack">
        ${checks.map(([label, ok, description, href]) => `<div class="between" style="gap:12px;align-items:flex-start;padding:9px 0;border-bottom:1px solid rgba(226,213,193,.6)"><div style="display:flex;gap:9px;align-items:flex-start"><span class="status-dot ${ok ? 'ok' : 'muted'}" style="margin-top:5px"></span><div><b style="font-size:12.5px">${esc(label)}</b><p class="tiny muted" style="margin-top:2px">${esc(description)}</p></div></div><a class="btn btn-ghost btn-xs" href="${attr(href)}">${ok ? 'Revisar' : 'Configurar'}</a></div>`).join('')}
      </div>
    </div>
    <div class="form-section">
      <p class="form-section-title">Lo que Lucian no hace</p>
      <div class="artifact-callout warn"><b>Sin promesas mágicas</b>No compra listas de correos, no inventa direcciones, no garantiza ventas, no reemplaza a un despachante de aduanas ni a un abogado. Los datos de mercado se investigan y se citan; las decisiones legales y fiscales las tomás vos.</div>
    </div>
    <div class="form-section">
      <p class="form-section-title">Bienvenida y primeros pasos</p>
      <p class="form-section-sub">Si querés volver a ver la pantalla de inicio, podés hacerlo. No se borra nada.</p>
      <div class="cluster">
        <button class="btn btn-ghost btn-sm" type="button" data-action="reset-onboarding">${icon('sun')} Ver bienvenida otra vez</button>
        <a class="btn btn-ghost btn-sm" href="#/equipo">${icon('users')} Cómo trabaja el equipo</a>
        <a class="btn btn-primary btn-sm" href="#/misiones/nueva">${icon('spark')} Lanzar una misión</a>
      </div>
    </div>`;
  return `<div class="settings-form">
    <div class="form-section"><p class="form-section-title">Cómo empezar sin enredarte</p><p class="form-section-sub">Lucian está pensada para una persona sola que hace lámparas, no para un departamento de ventas.</p></div>
    ${body}
  </div>`;
}

function renderConnections() {
  const data = S.connections || { connections: [], aiFailover: {} };
  const conns = arr(data.connections);
  const okCount = conns.filter((c) => c.ok).length;
  const fo = data.aiFailover || {};
  return `<div class="page-head">
    <div class="page-head-main">
      <p class="eyebrow">Conexiones</p>
      <h2 class="page-title">Tus integraciones, bajo control.</h2>
      <p class="page-sub">Los agentes diagnostican cada conexión y cambian automáticamente a la IA de respaldo si tu proveedor se queda sin cuota. Vos solo intervenís cuando falta una clave.</p>
    </div>
    <div class="page-actions">
      <button class="btn btn-ghost" type="button" data-action="connections-refresh">${icon('refresh')} Volver a diagnosticar</button>
      <a class="btn btn-primary" href="#/ajustes?tab=ia">${icon('settings')} Configurar</a>
    </div>
  </div>

  ${fo.fallbackActive || fo.primaryFailures >= 2 ? `<div class="artifact-callout warn"><b>IA de respaldo activa</b>El proveedor principal tuvo ${fo.primaryFailures} fallo(s): ${esc(fo.lastError || 'cuota agotada')}. Lucian está usando Ollama local (gratis e ilimitado). ${fo.lastFailureAt ? `Último fallo: ${relTime(new Date(fo.lastFailureAt).toISOString())}.` : ''}</div>` : ''}
  ${S.autopilot ? `<div class="artifact-callout ok"><b>🤖 Piloto de conexiones activo</b>Revisa tus integraciones cada ${S.autopilot.intervalMinutes || 10} min, cambia de IA si hay fallos, reintenta y te avisa por Telegram. ${S.autopilot.actions?.length ? `Última acción: ${esc(S.autopilot.actions[0])}.` : 'Sin incidencias.'} <button class="btn btn-ghost btn-xs mt-2" type="button" data-action="autopilot-run">${icon('play')} Ejecutar ahora</button></div>` : ''}

  <section class="stat-grid">
    ${statCard('Conexiones listas', `${okCount}/${conns.length}`, 'check', 'funcionando', '', '')}
    ${statCard('IA de respaldo', fo.fallbackActive ? 'Activa' : 'En espera', 'spark', fo.fallbackActive ? 'cambió de proveedor' : ' lista para activarse', '', fo.fallbackActive ? 'warm' : '')}
  </section>

  <section class="section">
    <div class="section-head"><div><h2 class="section-title">Estado de cada conexión</h2><p class="section-sub">Clic en "Probar" para verificarla en tiempo real.</p></div></div>
    <div class="card" style="padding:6px 0">
      ${conns.map((c) => `<div class="conn-row">
        <span class="status-dot ${c.ok ? 'ok' : 'muted'}"></span>
        <div style="min-width:0;flex:1">
          <b style="font-size:13px">${esc(c.name)}</b>
          <div class="tiny muted">${esc(c.detail || '')}</div>
        </div>
        <span class="badge badge-${c.ok ? 'ok' : 'warn'}">${c.ok ? 'Listo' : 'Pendiente'}</span>
        <button class="btn btn-ghost btn-xs" type="button" data-action="connection-test" data-id="${attr(c.id)}">${icon('refresh')} Probar</button>
      </div>`).join('')}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><div><h2 class="section-title">Configurar con IA (lenguaje natural)</h2><p class="section-sub">Contale qué querés lograr y los agentes ajustan mercados, tono, límites y seguimientos por vos.</p></div></div>
    <div class="card card-pad">
      <div class="field"><label for="conn-goal">¿Qué querés que logre?</label>
        <textarea class="textarea" id="conn-goal" rows="3" placeholder="Ej.: quiero vender lámparas de diseño en España y México a tiendas boutique, con un tono cercano y sin gastar mucho en correos">${esc(S.ui.connGoal || '')}</textarea>
      </div>
      <div class="cluster mt-3">
        <button class="btn btn-accent" type="button" data-action="conn-configure">${icon('wand')} Que lo configure la IA</button>
        ${S.ui.connResult ? `<span class="tiny">${esc(S.ui.connResult)}</span>` : ''}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><div><h2 class="section-title">Calendario de redes (próximos 7 días)</h2><p class="section-sub">Los agentes organizan qué publicar cada día. Vos solo copiás y pegás en la red.</p></div>
      <a class="section-link" href="#/contenido">Ver piezas ${icon('arrowRight')}</a>
    </div>
    <div class="plan-days">${contentCalendarHTML()}</div>
  </section>`;
}

function contentCalendarHTML() {
  const items = arr(S.state.content).filter((c) => c.status === 'idea').slice(0, 7);
  if (!items.length) return '<p class="muted small">No hay piezas pendientes de publicar. Lanzá una misión para generar contenido.</p>';
  return items.map((c, i) => {
    const day = c.day || `Día ${i + 1}`;
    const net = SOCIAL_NETWORKS.find((n) => n.id.toLowerCase() === String(c.platform || '').toLowerCase());
    return `<div class="plan-day">
      <span class="plan-num">${esc(day.replace(/\D/g, '') || String(i + 1))}</span>
      <div class="plan-content">
        <h5>${net ? esc(net.label) : esc(c.platform || 'Red')} · ${esc(c.format || 'Pieza')}</h5>
        <p>${esc(c.hook || '')}</p>
        <button class="btn btn-ghost btn-xs mt-2" type="button" data-action="content-quick-publish" data-id="${attr(c.id)}">${icon('send')} Preparar publicación</button>
      </div>
    </div>`;
  }).join('');
}

async function fetchConnections() {
  // Solo renderiza en la PRIMERA carga. Si renderizara siempre, bindView
  // volvería a llamarla y se generaría un bucle que reinicia la animación.
  const firstLoad = !S.connections;
  try {
    S.connections = await api('/api/connections', { silent: true });
    S.autopilot = await api('/api/autopilot', { silent: true }).catch(() => null);
    if (firstLoad && S.route.view === 'conexiones') render();
  } catch { /* silencio */ }
}

async function loadConnections() {
  // Para el botón "Volver a diagnosticar": trae datos y actualiza la vista.
  await fetchConnections();
  if (S.route.view === 'conexiones') render();
}

async function testConnectionUI(id, button) {
  const original = button?.innerHTML;
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Probando…`; }
  try {
    const result = await api('/api/connections/test', { method: 'POST', body: { id } });
    toast(result.ok ? `${id}: ${result.detail}` : `${id}: ${result.detail}`, result.ok ? 'ok' : 'error');
    await loadConnections();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    if (button) { button.disabled = false; button.innerHTML = original; }
  }
}

async function connConfigure() {
  const goal = String($('#conn-goal')?.value || '').trim();
  if (!goal) { toast('Contale qué querés lograr.', 'error'); return; }
  try {
    const result = await api('/api/settings/ai-configure', { method: 'POST', body: { goal } });
    await loadState({ silent: true, render: false });
    S.ui.connResult = result.summary || 'Configuración aplicada por la IA.';
    render();
    toast('Configuración aplicada por la IA.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderSettings() {
  const tab = settingsTabID();
  const panels = {
    marca: settingsBrandHTML,
    ia: settingsAIHTML,
    busqueda: settingsSearchHTML,
    correo: settingsEmailHTML,
    notificaciones: settingsNotifyHTML,
    'no-contactar': settingsSuppressionsHTML,
    misiones: settingsMissionHTML,
    datos: settingsDataHTML,
    ayuda: settingsHelpHTML,
  };
  const panel = (panels[tab] || panels.marca)();
  return `${settingsPageHead()}
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Secciones de ajustes">
        ${SETTINGS_TABS.map(([id, label, iconName]) => `<a class="settings-tab ${id === tab ? 'active' : ''}" href="#/ajustes?tab=${id}" ${id === tab ? 'aria-current="page"' : ''}>${icon(iconName)} ${esc(label)}</a>`).join('')}
      </nav>
      <div class="settings-panel">${panel}</div>
    </div>`;
}

function bindSettings() {
  const form = $('#settings-form');
  if (!form) return;
  const provider = $('#ai-provider');
  if (provider) {
    provider.addEventListener('change', () => {
      const preset = arr(S.state.providers).find((p) => p.id === provider.value);
      if (!preset) return;
      const base = $('#ai-base');
      const model = $('#ai-model');
      const vision = $('#ai-vision');
      const note = $('#ai-provider-note');
      const list = $('#ai-model-list');
      if (base) base.value = preset.baseUrl || '';
      if (model) model.value = preset.model || '';
      if (vision) vision.value = preset.vision || '';
      if (note) note.textContent = preset.note || '';
      if (list) list.innerHTML = arr(preset.models).map((m) => { const id = typeof m === 'string' ? m : (m.id || m.name || m.model || ''); return `<option value="${attr(id)}">`; }).join('');
      const link = $('#ai-key-link');
      if (link) {
        if (link.tagName === 'A') {
          if (preset.keyUrl) { link.href = safeUrl(preset.keyUrl) || '#'; link.style.display = ''; }
          else link.style.display = 'none';
        } else if (preset.keyUrl) {
          link.innerHTML = `<a href="${attr(safeUrl(preset.keyUrl))}" target="_blank" rel="noopener noreferrer">Conseguir una clave ${icon('external', 'icon-sm')}</a>`;
        }
      }
    });
  }
  const temp = $('#ai-temp');
  const tempValue = $('#ai-temp-value');
  if (temp && tempValue) temp.addEventListener('input', () => { tempValue.textContent = temp.value; });
  const restore = $('#restore-input');
  if (restore) restore.addEventListener('change', restoreBackupFile);
}

const AI_CONFIG_DEFAULT_GOAL = 'Analiza mi catalogo y configura Lucian para maximizar las ventas: elige los mejores mercados, profundidad, cantidad de prospectos, tono y limites de correo segun mis productos y situacion actual.';

async function aiConfigureSettings() {
  openModal({
    title: 'Configuración con IA',
    subtitle: 'La IA ajusta misiones, límites, seguimientos y cobros por vos. Nunca toca claves ni URLs de proveedores.',
    body: `<div class="field full">
      <label for="ai-config-goal">¿Qué querés que logre?</label>
      <textarea class="textarea" id="ai-config-goal" rows="4" placeholder="Contale qué querés vender y dónde.">${esc(AI_CONFIG_DEFAULT_GOAL)}</textarea>
      <p class="field-hint">Dejá el texto sugerido y aplicá la configuración óptima con un click.</p>
    </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-action="close-modal">Cancelar</button>
      <button class="btn btn-primary" type="button" id="ai-configure-apply">${icon('wand')} Que lo haga la IA</button>`,
    onMount: (root) => {
      const apply = root.querySelector('#ai-configure-apply');
      if (apply) apply.addEventListener('click', () => applyAiConfiguration(root.querySelector('#ai-config-goal')?.value || ''));
    }
  });
}

async function applyAiConfiguration(goal) {
  const button = $('#ai-configure-apply');
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Configurando”¦`; }
  try {
    const result = await api('/api/settings/ai-configure', { method: 'POST', body: JSON.stringify({ goal }) });
    closeModal();
    await loadState({ silent: true, render: false });
    render();
    toast(result.summary || 'Configuración aplicada por la IA.');
    openModal({
      title: 'Configuración aplicada',
      subtitle: 'La IA ajustó los parámetros de Lucian. No tocó ninguna clave.',
      body: `<p>${esc(result.summary || 'Listo.')}</p>`,
      footer: `<button class="btn btn-primary" type="button" data-action="close-modal">Entendido</button>`
    });
  } catch (error) {
    toast(error.message, 'error');
    if (button) { button.disabled = false; button.innerHTML = `${icon('wand')} Que lo haga la IA`; }
  }
}
async function saveSettings(form) {
  const tab = form.dataset.settingsTab || 'marca';
  const fd = new FormData(form);
  const val = (name) => String(fd.get(name) ?? '').trim();
  const check = (name) => Boolean(form.querySelector(`[name="${name}"]`)?.checked);
  const splitList = (value) => String(value || '').split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  let patch = null;

  if (tab === 'marca') {
    if (!val('brandName')) { toast('La marca necesita un nombre.', 'error'); $('#brand-name')?.focus(); return; }
    patch = {
      brand: {
        name: val('brandName'),
        maker: val('brandMaker'),
        tagline: val('brandTagline'),
        city: val('brandCity'),
        country: val('brandCountry'),
        website: val('brandWebsite'),
        instagram: val('brandInstagram'),
        email: val('brandEmail'),
        address: val('brandAddress'),
        currency: val('brandCurrency') || 'USD',
        languages: splitList(val('brandLanguages')),
      },
    };
  } else if (tab === 'ia') {
    const provider = val('provider') || 'openai';
    patch = {
      ai: {
        provider,
        apiKey: val('apiKey'),
        baseUrl: val('baseUrl'),
        model: val('model'),
        visionModel: val('visionModel'),
        temperature: Math.max(0, Math.min(1.2, num(val('temperature'), 0.6))),
        maxTokens: Math.max(512, Math.min(16000, Math.round(num(val('maxTokens'), 8192)))),
      },
    };
  } else if (tab === 'busqueda') {
    patch = {
      search: {
        provider: val('searchProvider') || 'duckduckgo',
        apiKey: val('searchApiKey'),
        searxUrl: val('searxUrl'),
        maxResults: Math.max(1, Math.min(10, Math.round(num(val('maxResults'), 8)))),
        prospectingDepth: val('prospectingDepth') === 'basic' ? 'basic' : 'advanced',
      },
      hunter: {
        enabled: check('hunterEnabled'),
        apiKey: val('hunterApiKey'),
      },
    };
  } else if (tab === 'correo') {
    patch = {
      email: {
        provider: val('emailProvider') || 'manual',
        resendKey: val('resendKey'),
        smtpUser: val('smtpUser'),
        smtpPassword: val('smtpPassword'),
        from: val('from'),
        replyTo: val('replyTo'),
        footer: val('footer'),
        dailyLimit: Math.max(1, Math.min(200, Math.round(num(val('dailyLimit'), 20)))),
        warmup: check('warmup'),
        webhookUrl: val('webhookUrl'),
        webhookToken: val('webhookToken'),
        autopilot: check('emailAutopilot'),
        autopilotSpacingMin: Math.max(1, Math.min(120, Math.round(num(val('autopilotSpacingMin'), 5)))),
        followUps: check('emailFollowUps'),
        postSales: check('emailPostSales'),
      },
      sales: {
        paymentLink: val('salesPaymentLink'),
        quoteValidityDays: Math.max(1, Math.min(120, Math.round(num(val('salesQuoteValidityDays'), 15)))),
      },
    };
  } else if (tab === 'notificaciones') {
    patch = {
      notify: {
        paused: check('notifyPaused'),
        telegram: {
          enabled: check('telegramEnabled'),
          token: val('tgToken'),
          chatId: val('tgChat'),
          digestHour: Math.max(0, Math.min(23, Math.round(num(val('tgDigest'), 9)))),
        },
        whatsapp: {
          enabled: check('whatsappEnabled'),
          token: val('waToken'),
          phoneNumberId: val('waPhoneId'),
          to: val('waTo'),
          verifyToken: val('waVerify') || 'lucian',
          apiVersion: val('waVersion') || 'v23.0',
        },
        events: {
          missionDone: check('eventMissionDone'),
          missionError: check('eventMissionError'),
          missionWarning: check('eventMissionWarning'),
          hotReply: check('eventHotReply'),
          optOut: check('eventOptOut'),
          digest: check('eventDigest'),
        },
      },
    };
  } else if (tab === 'misiones') {
    patch = {
      mission: {
        depth: val('missionDepth') || 'estandar',
        markets: splitList(val('missionMarkets')),
        tone: val('missionTone') || TONES[0],
        currency: val('missionCurrency') || 'USD',
        maxProspects: Math.max(1, Math.min(40, Math.round(num(val('missionMaxProspects'), 12)))),
        autoCreateThreads: check('autoCreateThreads'),
        reviewDirectory: check('reviewDirectory'),
        researchPages: check('researchPages'),
      },
    };
  }

  if (!patch) return;
  const button = form.querySelector('button[type="submit"]');
  if (button) { button.disabled = true; button.innerHTML = `${icon('refresh', 'spin')} Guardando”¦`; }
  try {
    const result = await api('/api/settings', { method: 'PUT', body: patch });
    S.state.settings = result.settings;
    S.state.flags = result.flags;
    if (result.settings?.brand) S.state.brand = result.settings.brand;
    await loadState({ silent: true, render: false });
    render();
    toast('Ajustes guardados.');
  } catch (error) {
    toast(error.message, 'error');
    if (button) { button.disabled = false; button.innerHTML = `${icon('check')} Guardar cambios`; }
  }
}

async function clearSecret(path) {
  const labels = {
    'ai.apiKey': 'la clave de IA',
    'search.apiKey': 'la clave de búsqueda',
    'hunter.apiKey': 'la clave de Hunter',
    'email.resendKey': 'la clave de Resend',
    'notify.telegram.token': 'el token de Telegram',
    'notify.whatsapp.token': 'el token de WhatsApp',
  };
  const confirmed = await confirmAction({
    title: 'Borrar credencial',
    message: `¿Borrar ${labels[path] || 'esta credencial'}? Lucian deja de usarla hasta que pegues una nueva.`,
    confirmLabel: 'Borrar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    const result = await api('/api/settings/secret/clear', { method: 'POST', body: { path }, silent: true });
    S.state.settings = result.settings;
    S.state.flags = result.flags;
    await loadState({ silent: true, render: false });
    render();
    toast('Credencial borrada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function showTestResult(target, ok, payload) {
  const box = document.querySelector(`[data-test-result="${target}"]`);
  if (!box) return;
  let details = '';
  if (payload !== undefined && payload !== null) {
    if (typeof payload === 'object') {
      details = Object.entries(payload).map(([key, value]) => {
        const clean = value === null || value === undefined ? '””' : typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${clean}`;
      }).join('\n');
    } else {
      details = String(payload);
    }
  }
  box.className = `test-result show ${ok ? 'ok' : 'error'}`;
  box.innerHTML = `<b>${ok ? 'Funcionó' : 'No funcionó'}</b>${details ? `<div style="white-space:pre-wrap;margin-top:4px">${esc(truncate(details, 1200))}</div>` : ''}`;
}

async function runSettingsTest(button) {
  const target = button.dataset.target;
  if (!target) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${icon('refresh', 'spin')} Probando”¦`;
  try {
    const result = await api('/api/settings/test', { method: 'POST', body: { target }, silent: true });
    showTestResult(target, Boolean(result.ok), result.ok ? result.result : result.error);
    toast(result.ok ? 'La prueba salió bien.' : 'La prueba encontró un problema.', result.ok ? 'ok' : 'error');
  } catch (error) {
    showTestResult(target, false, error.message);
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

async function loadAIModels(button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${icon('refresh', 'spin')} Buscando”¦`;
  const container = $('#ai-models');
  try {
    const result = await api('/api/ai/models', { silent: true });
    const models = arr(result.models);
    if (container) {
      container.innerHTML = models.length
        ? `<span class="tiny muted">Modelos disponibles en ${esc(result.provider || 'el proveedor')}:</span>${models.map((model) => {
            const id = typeof model === 'string' ? model : (model.id || model.name || model.model || '');
            const label = typeof model === 'string' ? model : (model.label || model.displayName || model.name || id);
            return `<button class="chip" type="button" data-action="pick-model" data-model="${attr(id)}">${esc(label)}</button>`;
          }).join('')}`
        : '<span class="tiny muted">El proveedor no devolvió una lista de modelos. Podés escribirlo a mano.</span>';
    }
    toast(models.length ? `${models.length} modelos encontrados.` : 'No hay modelos para mostrar.', 'info');
  } catch (error) {
    if (container) container.innerHTML = `<span class="tiny" style="color:var(--danger)">${esc(error.message)}</span>`;
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function pickAIModel(model) {
  const input = $('#ai-model');
  if (input) {
    input.value = model;
    input.focus();
  }
  toast('Modelo seleccionado. Guardá los cambios para usarlo.');
}

async function findTelegramChats(button) {
  const original = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `${icon('refresh', 'spin')} Buscando”¦`;
  const container = $('#telegram-chats');
  try {
    const tokenField = $('#tg-token');
    const token = String(tokenField?.value || '').trim();
    const body = token && !token.startsWith('”¢”¢') ? { token } : {};
    const result = await api('/api/settings/telegram/chats', { method: 'POST', body, silent: true });
    const chats = arr(result.chats);
    if (container) {
      container.innerHTML = chats.length
        ? `<span class="tiny muted">Elegí el chat que recibe los avisos:</span>${chats.map((chat) => `<button class="chip" type="button" data-action="pick-chat" data-chat-id="${attr(chat.id)}" data-chat-name="${attr(chat.name || chat.username || chat.id)}">${esc(chat.name || chat.username || chat.id)}</button>`).join('')}`
        : '<span class="tiny muted">No encontré chats. Escribile primero al bot desde tu cuenta y volvé a intentar.</span>';
    }
  } catch (error) {
    if (container) container.innerHTML = `<span class="tiny" style="color:var(--danger)">${esc(error.message)}</span>`;
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

function pickTelegramChat(id, name) {
  const input = $('#tg-chat');
  if (input) {
    input.value = id;
    input.focus();
  }
  toast(`Chat seleccionado: ${name || id}. Guardá los cambios.`);
}

async function restoreBackupFile(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  const confirmed = await confirmAction({
    title: 'Restaurar copia de seguridad',
    message: `Vas a reemplazar los datos actuales por “${file.name}”. Esta acción no se puede deshacer.`,
    details: 'Descargá una copia de lo actual antes de continuar si hay algo que te importa.',
    confirmLabel: 'Restaurar',
    danger: true,
  });
  if (!confirmed) { input.value = ''; return; }
  try {
    const buffer = await file.arrayBuffer();
    const result = await api('/api/restore', {
      method: 'POST',
      body: buffer,
      headers: { 'content-type': 'application/zip' },
      silent: true,
    });
    await loadState({ silent: true, render: false });
    navigate('#/panel');
    toast(`Copia restaurada: ${result.products} productos, ${result.missions} misiones y ${result.threads} conversaciones.`);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    input.value = '';
  }
}

async function setOnboarding(patch = {}) {
  try {
    const result = await api('/api/settings', { method: 'PUT', body: { onboarding: patch }, silent: true });
    S.state.settings = result.settings;
    S.state.flags = result.flags;
    S.state.onboarding = { ...(S.state.onboarding || {}), ...patch };
    return true;
  } catch {
    return false;
  }
}

async function seedDemo() {
  try {
    closeModal(true);
    await setOnboarding({ done: true });
    const result = await api('/api/demo/seed', { method: 'POST', silent: true });
    await loadState({ silent: true, render: false });
    S.mission = null;
    S.thread = null;
    navigate('#/panel');
    toast(result.already ? 'Los datos de ejemplo ya estaban cargados.' : 'Datos de ejemplo cargados. Todo está marcado como demo.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function clearDemo() {
  const confirmed = await confirmAction({
    title: 'Borrar datos de ejemplo',
    message: 'Se van a borrar solo los productos, misiones, conversaciones, contenido y aprendizajes marcados como demo. Tus datos reales quedan intactos.',
    confirmLabel: 'Borrar ejemplos',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api('/api/demo', { method: 'DELETE', silent: true });
    await loadState({ silent: true, render: false });
    S.mission = null;
    S.thread = null;
    navigate('#/panel');
    toast('Datos de ejemplo borrados.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function resetOnboarding() {
  S.ui.onboardingShown = false;
  S.ui.welcomeDismissed = false;
  await setOnboarding({ done: false });
  render();
  maybeShowWelcome();
}

/* ─────────────────────────────────────────────────────────────
   19. Acciones de la interfaz
   ───────────────────────────────────────────────────────────── */

function toggleMobileNav(force) {
  const drawer = $('#mobile-drawer');
  if (!drawer) return;
  const open = typeof force === 'boolean' ? force : !drawer.classList.contains('open');
  drawer.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', String(!open));
}

function closeMobileNav() {
  toggleMobileNav(false);
}

async function cancelMission(id) {
  const confirmed = await confirmAction({
    title: 'Cancelar misión',
    message: 'La misión se cancela AHORA, incluso si la IA está respondiendo. Lo que ya produjo queda guardado.',
    confirmLabel: 'Cancelar misión',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api(`/api/missions/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
    await loadState({ silent: true, render: false });
    if (S.mission?.mission?.id === id) {
      S.mission = null;
      await loadMission(id);
    } else {
      render();
    }
    toast('Misión cancelada. La IA se detuvo y lo ya producido quedó guardado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function retryMission(id) {
  const confirmed = await confirmAction({
    title: 'Reintentar misión',
    message: 'El equipo retoma desde el último paso completado. No vuelve a pagar los pasos que ya salieron bien. Los borradores existentes se reconcilian con la última revisión; si el contenido cambia, vuelven a revisión.',
    confirmLabel: 'Reintentar',
  });
  if (!confirmed) return;
  try {
    await api(`/api/missions/${encodeURIComponent(id)}/retry`, { method: 'POST' });
    S.mission = null;
    await loadState({ silent: true, render: false });
    await loadMission(id);
    toast('Misión reanudada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function reconcileMission(id) {
  const confirmed = await confirmAction({
    title: 'Revalidar borradores',
    message: 'Se recalculan los borradores de esta misión con la revisión más reciente: mensajes 1:1, correcciones de cumplimiento y estado de aprobación. No se envía nada.',
    confirmLabel: 'Revalidar',
  });
  if (!confirmed) return;
  try {
    const result = await api(`/api/missions/${encodeURIComponent(id)}/reconcile`, { method: 'POST' });
    S.mission = null;
    await loadState({ silent: true, render: false });
    await loadMission(id);
    toast(`Revalidado: ${num(result.created)} nuevos, ${num(result.updated)} actualizados.`);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function pendingResendCount() {
  return arr(S.state.threads).reduce((acc, t) => acc + num(t.pendingResends), 0);
}

async function prepareResends() {
  const count = pendingResendCount();
  if (!count) { toast('No hay reenvíos pendientes.', 'info'); return; }
  const confirmed = await confirmAction({
    title: 'Preparar reenvíos',
    message: `¿Preparar ${count} borrador${count === 1 ? '' : 'es'} con el texto de los correos que no se entregaron?`,
    details: 'Se crea un borrador listo en cada conversación. Después lo revisás y lo enviás por tu correo (Copiar o .eml). El intento original queda registrado.',
    confirmLabel: 'Preparar',
  });
  if (!confirmed) return;
  try {
    const result = await api('/api/threads/prepare-resends', { method: 'POST' });
    await loadState({ silent: true, render: false });
    if (S.thread?.thread?.id) await loadThread(S.thread.thread.id, { force: true });
    render();
    toast(result.prepared ? `Se prepararon ${result.prepared} reenvíos. Revisá los borradores en cada conversación.` : 'Los reenvíos ya estaban preparados.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteAllThreads() {
  const threads = arr(S.state.threads);
  if (!threads.length) { toast('No hay conversaciones para borrar.', 'info'); return; }
  const confirmed = await confirmAction({
    title: 'Borrar TODAS las conversaciones',
    message: `¿Borrar las ${threads.length} conversaciones con todos sus mensajes, borradores y cotizaciones?`,
    details: 'Esta acción no se puede deshacer. Tus lámparas, misiones y contenido quedan intactos.',
    confirmLabel: 'Borrar todas',
    danger: true,
  });
  if (!confirmed) return;
  try {
    const result = await api('/api/threads/all', { method: 'DELETE' });
    S.thread = null;
    await loadState({ silent: true, render: false });
    render();
    toast(`Se borraron ${result.deleted} conversaciones.`);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteAllContent() {
  const items = arr(S.state.content);
  if (!items.length) { toast('No hay contenido para borrar.', 'info'); return; }
  const confirmed = await confirmAction({
    title: 'Borrar TODO el contenido',
    message: `¿Borrar las ${items.length} piezas de contenido (ideas, guiones y publicaciones)?`,
    details: 'Esta acción no se puede deshacer. Tus lámparas, misiones y conversaciones quedan intactos.',
    confirmLabel: 'Borrar todo',
    danger: true,
  });
  if (!confirmed) return;
  try {
    const result = await api('/api/content/all', { method: 'DELETE' });
    await loadState({ silent: true, render: false });
    render();
    toast(`Se borraron ${result.deleted} piezas de contenido.`);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteAllMissions() {
  const missions = arr(S.state.missions);
  if (!missions.length) { toast('No hay misiones para borrar.', 'info'); return; }
  const running = missions.filter((m) => ['running', 'queued'].includes(m.status)).length;
  const confirmed = await confirmAction({
    title: 'Borrar TODAS las misiones',
    message: `¿Borrar las ${missions.length} misiones? ${running ? `Hay ${running} en curso: se detendrán.` : ''} Se borra el registro de las misiones, pero NO las conversaciones ni el contenido que crearon.`,
    details: 'Esta acción no se puede deshacer. Tus lámparas, conversaciones y contenido quedan intactos.',
    confirmLabel: 'Borrar todas',
    danger: true,
  });
  if (!confirmed) return;
  try {
    const result = await api('/api/missions/all', { method: 'DELETE' });
    S.mission = null;
    disconnectMission();
    await loadState({ silent: true, render: false });
    render();
    toast(`Se borraron ${result.deleted} misiones. Las conversaciones y el contenido siguen ahí.`);
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteMission(id) {
  const mission = arr(S.state.missions).find((m) => m.id === id);
  const confirmed = await confirmAction({
    title: 'Borrar misión',
    message: `¿Borrar “${mission?.name || 'esta misión'}”? Se elimina el registro de la misión, pero no las conversaciones ni el contenido que ya creó.`,
    confirmLabel: 'Borrar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api(`/api/missions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    S.mission = null;
    await loadState({ silent: true, render: false });
    navigate('#/misiones');
    toast('Misión borrada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteProduct(id) {
  const product = arr(S.state.products).find((p) => p.id === id);
  const confirmed = await confirmAction({
    title: 'Eliminar lámpara',
    message: `¿Eliminar “${product?.name || 'este producto'}” y sus fotos? Las misiones y conversaciones anteriores conservan el nombre como referencia.`,
    confirmLabel: 'Eliminar',
    danger: true,
  });
  if (!confirmed) return;
  try {
    await api(`/api/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    closeModal(true);
    await loadState({ silent: true, render: false });
    render();
    toast('Producto eliminado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

function removeProductPhoto(index) {
  S.ui.productPhotos.splice(index, 1);
  const thumbs = $('#photo-thumbs');
  if (thumbs) thumbs.innerHTML = photoThumbsHTML();
  const count = $('#photo-count');
  if (count) count.textContent = `${S.ui.productPhotos.length} de 6 fotos`;
}

function wizardAction(action, el) {
  const w = S.wizard || ensureWizard();
  if (action === 'wizard-next') {
    syncWizardFields();
    if (w.step < 4) w.step += 1;
    render();
    return;
  }
  if (action === 'wizard-prev') {
    syncWizardFields();
    if (w.step > 1) w.step -= 1;
    render();
    return;
  }
  if (action === 'wizard-product') {
    w.productId = el.dataset.id;
    w.step = 2;
    render();
    return;
  }
  if (action === 'wizard-goal') {
    w.goal = el.dataset.id;
    w.step = 3;
    render();
    return;
  }
  if (action === 'wizard-market') {
    const market = el.dataset.market;
    if (w.markets.includes(market)) w.markets = w.markets.filter((m) => m !== market);
    else w.markets.push(market);
    render();
    return;
  }
  if (action === 'wizard-remove-market') {
    w.markets = w.markets.filter((m) => m !== el.dataset.market);
    render();
    return;
  }
  if (action === 'wizard-depth') {
    w.depth = el.dataset.id;
    render();
    return;
  }
  if (action === 'wizard-mode') {
    const mode = el.dataset.id;
    if (mode === 'real' && !S.state.flags?.ai) {
      toast('Configurá una IA en Ajustes para correr misiones reales.', 'info');
      return;
    }
    w.mode = mode;
    render();
    return;
  }
  if (action === 'wizard-add-market') addCustomMarket();
  if (action === 'wizard-launch') launchWizard();
}

async function handleAction(action, el) {
  switch (action) {
    case 'close-modal': closeModal(); return;
    case 'confirm-yes': {
      const resolve = confirmResolve;
      confirmResolve = null;
      closeModal(true);
      if (resolve) resolve(true);
      return;
    }
    case 'confirm-no': {
      const resolve = confirmResolve;
      confirmResolve = null;
      closeModal(true);
      if (resolve) resolve(false);
      return;
    }
    case 'toggle-mobile-nav': toggleMobileNav(); return;
    case 'reload-state': await loadState(); return;
    case 'new-product': openProductModal(); return;
    case 'import-products': $('#product-import-input')?.click(); return;
    case 'campaign-catalog': openCampaignModal(); return;
    case 'campaign-selected': {
      if (!S.ui.selectedProducts.length) { toast('Seleccioná al menos un producto.', 'error'); return; }
      openCampaignModal(S.ui.selectedProducts);
      return;
    }
    case 'toggle-product-select': {
      const id = el.dataset.id;
      if (!id) return;
      const idx = S.ui.selectedProducts.indexOf(id);
      if (idx === -1) S.ui.selectedProducts.push(id);
      else S.ui.selectedProducts.splice(idx, 1);
      if (S.route.view === 'productos' && !S.route.id) render();
      return;
    }
    case 'launch-campaign': await launchCampaign(); return;
    case 'edit-product': openProductModal(el.dataset.id); return;
    case 'delete-product': await deleteProduct(el.dataset.id); return;
    case 'save-product': await saveProduct(); return;
    case 'remove-photo': removeProductPhoto(num(el.dataset.index)); return;
    case 'new-mission':
      S.wizard = null;
      ensureWizard();
      navigate('#/misiones/nueva');
      return;
    case 'demo-seed': await seedDemo(); return;
    case 'clear-demo': await clearDemo(); return;
    case 'welcome-demo':
      await setOnboarding({ done: true });
      closeModal(true);
      await seedDemo();
      return;
    case 'welcome-skip':
      await setOnboarding({ done: true });
      closeModal(true);
      toast('Cuando quieras, cargá tu primera lámpara.');
      return;
    case 'welcome-start':
      await setOnboarding({ done: true });
      closeModal(true);
      openProductModal();
      return;
    case 'wizard-next':
    case 'wizard-prev':
    case 'wizard-product':
    case 'wizard-goal':
    case 'wizard-market':
    case 'wizard-remove-market':
    case 'wizard-depth':
    case 'wizard-mode':
    case 'wizard-add-market':
    case 'wizard-launch':
      wizardAction(action, el);
      return;
    case 'mission-cancel': await cancelMission(el.dataset.id); return;
    case 'mission-retry': await retryMission(el.dataset.id); return;
    case 'mission-reconcile': await reconcileMission(el.dataset.id); return;
    case 'mission-delete': await deleteMission(el.dataset.id); return;
    case 'delete-all-missions': await deleteAllMissions(); return;
    case 'delete-all-threads': await deleteAllThreads(); return;
    case 'prepare-resends': await prepareResends(); return;
    case 'check-inbox': {
      const button = el;
      const original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon('refresh', 'spin')} Revisando…`;
      try {
        await api('/api/email/check-inbox', { method: 'POST' });
        await loadState({ silent: true, render: false });
        render();
        toast('Bandeja revisada. Si hay respuestas nuevas, ya están acá.');
      } catch (error) {
        toast(error.message, 'error');
        button.disabled = false;
        button.innerHTML = original;
      }
      return;
    }
    case 'delete-all-content': await deleteAllContent(); return;
    case 'toggle-step': {
      const id = el.dataset.id;
      if (!id) return;
      if (S.ui.openSteps.has(id)) S.ui.openSteps.delete(id);
      else S.ui.openSteps.add(id);
      repaintMission();
      return;
    }
    case 'ask-suggestion': fillAskSuggestion(el.dataset.question || ''); return;
    case 'ask-agent': {
      const agentId = el.dataset.id || 'director';
      S.ui.ask = { ...S.ui.ask, agentId };
      if (S.route.view !== 'equipo') navigate('#/equipo');
      else render();
      setTimeout(() => {
        $('#ask-question')?.focus();
        $('#ask-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 90);
      return;
    }
    case 'inbox-filter': {
      S.ui.inboxFilter = el.dataset.filter || 'todos';
      $$('#inbox-filters .chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.filter === S.ui.inboxFilter));
      applyInboxList();
      return;
    }
    case 'inbox-reset':
      S.ui.inboxFilter = 'todos';
      S.ui.inboxQuery = '';
      render();
      return;
    case 'reload-thread': await loadThread(el.dataset.id, { force: true }); return;
    case 'edit-contact': {
      if (!S.thread?.thread) return;
      openContactModal(S.thread.thread);
      return;
    }
    case 'save-contact': await saveContact(el.dataset.id); return;
    case 'ai-configure': await aiConfigureSettings(); return;
    case 'quote-catalog': openCatalogQuoteModal(); return;
    case 'quote-catalog-build': await buildCatalogQuote(); return;
    case 'save-catalog-quote': await saveCatalogQuote(); return;
    case 'new-quote': {
      if (!S.thread?.thread) return;
      openQuoteModal(S.thread.thread);
      return;
    }
    case 'save-quote': await saveQuote(el.dataset.id); return;
    case 'quote-add-all': {
      const products = arr(S.state.products).filter((p) => p.status !== 'archivado');
      const lines = $('#quote-lines');
      if (!lines || !products.length) return;
      const existing = new Set([...lines.querySelectorAll('[name="productId"]')].map((i) => i.value));
      const missing = products.filter((p) => !existing.has(p.id));
      if (!missing.length) { toast('Ya están todas las lámparas en la cotización.', 'info'); return; }
      missing.forEach((p, i) => {
        lines.insertAdjacentHTML('beforeend', quoteLineHTML(p, lines.querySelectorAll('[data-quote-line]').length, p.currency || S.state.brand?.currency || 'USD'));
      });
      refreshQuotePreview();
      toast(`Se agregaron ${missing.length} lámparas. Ajustá cantidades y precios a tu gusto.`);
      return;
    }
    case 'quote-add-line': {
      const products = arr(S.state.products).filter((p) => p.status !== 'archivado');
      if (!products.length) { toast('No hay lámparas en el catálogo.', 'error'); return; }
      const lines = $('#quote-lines');
      if (!lines) return;
      const idx = lines.querySelectorAll('[data-quote-line]').length;
      lines.insertAdjacentHTML('beforeend', quoteLineHTML(products[0], idx, S.state.brand?.currency || 'USD'));
      refreshQuotePreview();
      return;
    }
    case 'quote-remove-line': {
      const el2 = document.querySelector(`[data-quote-line="${el.dataset.index}"]`);
      if (!el2) return;
      if (document.querySelectorAll('[data-quote-line]').length <= 1) { toast('Dejá al menos una lámpara.', 'info'); return; }
      el2.remove();
      refreshQuotePreview();
      return;
    }
    case 'quote-status': await setQuoteStatusUI(el.dataset.id, el.dataset.quoteId, el.dataset.status); return;
    case 'record-payment': openPaymentModal(el.dataset.id, el.dataset.quoteId); return;
    case 'save-payment': await savePaymentUI(el.dataset.id, el.dataset.quoteId); return;
    case 'new-draft': {
      if (!S.thread?.thread) return;
      openDraftModal(S.thread.thread);
      return;
    }
    case 'save-new-draft': await saveNewDraft(el.dataset.id); return;
    case 'edit-draft':
      S.ui.threadDraftEdit = el.dataset.draftId;
      repaintThread();
      return;
    case 'cancel-draft-edit':
      S.ui.threadDraftEdit = null;
      repaintThread();
      return;
    case 'save-draft': await saveDraftEdit(el.dataset.id, el.dataset.draftId); return;
    case 'approve-draft': await approveDraft(el.dataset.id, el.dataset.draftId); return;
    case 'discard-draft': await setDraftStatus(el.dataset.id, el.dataset.draftId, 'descartado'); return;
    case 'delete-draft': await deleteDraft(el.dataset.id, el.dataset.draftId); return;
    case 'send-draft': {
      const thread = S.thread?.thread;
      const draft = arr(thread?.drafts).find((d) => d.id === el.dataset.draftId);
      if (thread && draft) openSendModal(thread, draft);
      return;
    }
    case 'send-channel': await sendDraftChannel(el.dataset.id, el.dataset.draftId, el.dataset.channel); return;
    case 'download-eml': await downloadEml(el.dataset.id, el.dataset.draftId); return;
    case 'analyze-thread': await analyzeCurrentThread(el); return;
    case 'delete-thread': await deleteThread(el.dataset.id); return;
    case 'content-publish': {
      const item = arr(S.state.content).find((c) => c.id === el.dataset.id);
      if (item) openPublishModal(item);
      return;
    }
    case 'save-publish': await savePublish(el.dataset.id); return;
    case 'social-open': await socialOpen(el.dataset.network, el.dataset.url); return;
    case 'connections-refresh': await loadConnections(); toast('Diagnóstico actualizado.'); return;
    case 'autopilot-run': {
      const r = await api('/api/autopilot/run', { method: 'POST' });
      await loadConnections();
      toast(r.actions?.length ? `Piloto: ${r.actions.join(' | ')}` : 'Piloto: todo en orden, sin acciones necesarias.');
      return;
    }
    case 'connection-test': await testConnectionUI(el.dataset.id, el); return;
    case 'conn-configure': await connConfigure(); return;
    case 'content-quick-publish': {
      const item = arr(S.state.content).find((c) => c.id === el.dataset.id);
      if (item) openPublishModal(item);
      return;
    }
    case 'content-edit': {
      const item = arr(S.state.content).find((c) => c.id === el.dataset.id);
      if (item) openContentModal(item);
      return;
    }
    case 'save-content': await saveContentEdit(el.dataset.id); return;
    case 'content-delete': await deleteContent(el.dataset.id); return;
    case 'learning-filter':
      S.ui.learningFilter = el.dataset.filter || 'todos';
      render();
      return;
    case 'add-learning': openLearningModal(); return;
    case 'save-learning': await saveLearning(); return;
    case 'toggle-learning': await toggleLearning(el.dataset.id); return;
    case 'delete-learning': await deleteLearning(el.dataset.id); return;
    case 'delete-suppression': await deleteSuppression(el.dataset.id); return;
    case 'test-integration': await runSettingsTest(el); return;
    case 'load-models': await loadAIModels(el); return;
    case 'pick-model': pickAIModel(el.dataset.model); return;
    case 'find-chats': await findTelegramChats(el); return;
    case 'pick-chat': pickTelegramChat(el.dataset.chatId, el.dataset.chatName); return;
    case 'clear-secret': await clearSecret(el.dataset.path); return;
    case 'copy-el': {
      const target = document.getElementById(el.dataset.target);
      if (!target) return;
      await copyToClipboard('value' in target ? target.value : target.textContent, 'Copiado.');
      return;
    }
    case 'copy-webhook':
      await copyToClipboard(`${location.origin}/api/webhooks/whatsapp`, 'URL copiada.');
      return;
    case 'restore-backup':
      $('#restore-input')?.click();
      return;
    case 'reset-onboarding': await resetOnboarding(); return;
    default:
      console.warn('Acción no implementada:', action);
  }
}

function onGlobalClick(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;
  if (el.classList.contains('disabled') || el.getAttribute('aria-disabled') === 'true') return;
  Promise.resolve(handleAction(el.dataset.action, el)).catch((error) => {
    console.error(error);
    toast(error.message || 'Algo salió mal.', 'error');
  });
}

function onGlobalChange(event) {
  const target = event.target;
  if (target.id === 'thread-stage') {
    updateThreadStage(target.dataset.threadId, target.value);
    return;
  }
  if (target.matches('[data-content-status]')) {
    updateContentStatus(target.dataset.contentStatus, target.value);
    return;
  }
  if (target.id === 'ask-agent') {
    S.ui.ask = { ...S.ui.ask, agentId: target.value };
  }
}

function onGlobalSubmit(event) {
  const form = event.target;
  const id = form.id;
  if (!id) return;
  const actions = {
    'settings-form': () => saveSettings(form),
    'product-form': () => saveProduct(),
    'ask-form': () => askTeamSubmit(),
    'inbound-form': () => addInboundMessage(form),
    'thread-notes-form': () => saveThreadDetails(form),
    'contact-form': () => saveContact(form.dataset.threadId),
    'draft-form': () => saveNewDraft(form.dataset.threadId),
    'content-form': () => saveContentEdit(form.dataset.id),
    'learning-form': () => saveLearning(),
    'suppression-form': () => saveSuppression(),
  };
  const handler = actions[id];
  if (!handler) return;
  event.preventDefault();
  Promise.resolve(handler()).catch((error) => {
    console.error(error);
    toast(error.message || 'No pude guardar.', 'error');
  });
}

function onGlobalKeydown(event) {
  if (event.key === 'Escape') {
    if (document.body.classList.contains('modal-open')) closeModal();
    else closeMobileNav();
    return;
  }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-action][role="button"]')) {
    event.preventDefault();
    event.target.click();
  }
}

function bindTeam() {
  const question = $('#ask-question');
  if (question) question.addEventListener('input', () => { S.ui.ask = { ...S.ui.ask, question: question.value }; });
  const agent = $('#ask-agent');
  if (agent) agent.addEventListener('change', () => { S.ui.ask = { ...S.ui.ask, agentId: agent.value }; });
}

function bindView(route) {
  if (!route) return;
  if (route.view === 'productos' && !route.id) bindProducts();
  else if (route.view === 'productos' && route.id) bindProductRoute(route.id);
  else if (route.view === 'misiones' && route.id === 'nueva') bindWizard();
  else if (route.view === 'ventas') bindVentas();
  else if (route.view === 'bandeja') bindInbox();
  else if (route.view === 'contenido') bindContent();
  else if (route.view === 'equipo') bindTeam();
  else if (route.view === 'conexiones') fetchConnections();
  else if (route.view === 'ajustes') bindSettings();
}

/* ─────────────────────────────────────────────────────────────
   20. Arranque
   ───────────────────────────────────────────────────────────── */

function init() {
  // Las claves no se aceptan por URL: pueden quedar en historiales y registros.
  try {
    const params = new URLSearchParams(location.search);
    if (params.has('access')) {
      params.delete('access');
      history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
    }
  } catch { /* noop */ }
  document.addEventListener('click', onGlobalClick);
  document.addEventListener('change', onGlobalChange);
  document.addEventListener('submit', onGlobalSubmit);
  document.addEventListener('keydown', onGlobalKeydown);
  window.addEventListener('hashchange', () => {
    closeMobileNav();
    render();
    const main = $('#contenido');
    if (main && window.innerWidth > 760) main.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) closeMobileNav();
  });
  if (!location.hash) {
    try { history.replaceState(null, '', '#/panel'); } catch { /* noop */ }
  }
  loadState({ render: true });
}

init();


