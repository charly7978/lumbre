const state = {
  health: null,
  demo: false,
  view: 'panel',
  products: [],
  leads: [],
  outbox: [],
  conversations: [],
  content: [],
  configRows: [],
  metrics: [],
  makeScenarios: [],
  filters: { products: 'all', leads: 'all', inbox: 'outbox', content: 'all' },
  pendingPhotos: []
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function stripHtml(value) {
  const doc = new DOMParser().parseFromString(String(value ?? ''), 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function money(value, currency) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 'Sin precio';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0
    }).format(number);
  } catch {
    return `$${number}`;
  }
}

function dateShort(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return esc(value);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

function todayLong() {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

async function api(path, options = {}) {
  if (state.demo) throw new Error('Estás en modo demo. Conectá Airtable para editar.');
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo completar la acción.');
  return data;
}

function toast(message, type = 'success') {
  const root = $('#toast-root');
  const icon = type === 'error' ? 'i-x' : type === 'success' ? 'i-check' : 'i-spark';
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<svg class="icon"><use href="#${icon}"/></svg><span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  }, 4200);
}

function openModal({ title, subtitle = '', body = '', footer = '', wide = false }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div><h3>${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
        <button class="icon-btn" data-action="close-modal" type="button" aria-label="Cerrar"><svg class="icon"><use href="#i-x"/></svg></button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  root.classList.remove('hidden');
  setTimeout(() => {
    const focusable = root.querySelector('input, select, textarea, button.primary');
    if (focusable) focusable.focus();
  }, 80);
}

function closeModal() {
  const root = $('#modal-root');
  root.classList.add('hidden');
  root.innerHTML = '';
  state.pendingPhotos = [];
}

function getConfigValue(key, fallback = '') {
  const row = state.configRows.find((item) => String(item.Clave).toLowerCase() === key.toLowerCase());
  return row?.Valor || fallback;
}

function getBrand() {
  return getConfigValue('marca', 'Estudio') || 'Estudio';
}

function showOnboarding() {
  $('#onboarding').classList.remove('hidden');
  $('#shell').classList.add('hidden');
}

function showShell() {
  $('#onboarding').classList.add('hidden');
  $('#shell').classList.remove('hidden');
}

function statusPill(value) {
  const map = {
    Activo: 'green', Aprobado: 'green', Enviado: 'blue', Respondido: 'green', Ganado: 'green', Publicado: 'green', Aprobada: 'green', Calificado: 'green', Negociacion: 'green', Propuesta: 'green', Contactado: 'blue', Investigado: 'amber', Nuevo: 'gray', En_revision: 'amber', Enrevision: 'amber', Borrador: 'gray', Pendiente: 'amber', Pausado: 'gray', Agotado: 'gray', Cancelado: 'red', Descartado: 'red', Perdido: 'red', OptOut: 'red', Error: 'red', Spam: 'red', No_interesado: 'gray', Cerrada: 'gray', Objecion: 'amber', Interesado: 'green', Pide_precio: 'blue', Pide_catalogo: 'blue', Socio: 'purple', Otro: 'gray'
  };
  const cls = map[value] || 'gray';
  return `<span class="pill ${cls}"><span class="dot"></span>${esc(value || 'Sin estado')}</span>`;
}

function scoreClass(score) {
  const value = Number(score);
  if (value >= 4) return 's4';
  if (value === 3) return 's3';
  return 's2';
}

function productImage(product) {
  const photo = Array.isArray(product.Fotos) ? product.Fotos[0] : null;
  if (photo?.url) {
    return `<img src="${esc(photo.url)}" alt="${esc(product.Producto || 'Producto')}" loading="lazy" onerror="this.style.display='none'">`;
  }
  return `<div class="placeholder"><svg class="icon"><use href="#i-lamp"/></svg></div>`;
}

function productCard(product) {
  return `<article class="product-card" data-action="view-product" data-id="${esc(product.id)}">
    <div class="product-media">${productImage(product)}</div>
    <div class="product-body">
      <div class="product-title">${esc(product.Producto || 'Sin nombre')}</div>
      <div class="product-price">${money(product.Precio, product.Moneda)}</div>
      <div class="product-desc">${esc(product.Descripcion_corta || product.Argumentos_venta || 'Sin descripcion')}</div>
      <div class="product-foot">
        ${statusPill(product.Estado || 'Borrador')}
        <span class="tiny muted">${esc(product.SKU || '')}</span>
      </div>
    </div>
  </article>`;
}

function emptyState(icon, title, text, action = '') {
  return `<div class="empty">
    <svg class="icon"><use href="#i-${icon}"/></svg>
    <strong>${esc(title)}</strong>
    <p>${esc(text)}</p>
    ${action}
  </div>`;
}

function draftInboxItem(draft) {
  return `<div class="inbox-item" data-action="preview-outbox" data-id="${esc(draft.id)}" role="button" tabindex="0">
    <div class="item-icon"><svg class="icon"><use href="#i-mail"/></svg></div>
    <div class="item-main">
      <div class="item-title">${esc(draft.Asunto || 'Sin asunto')}</div>
      <div class="item-sub">${esc(draft.Para || '')} · ${esc(draft.Producto || '')}</div>
    </div>
    <div class="item-actions">${statusPill(draft.Estado)}</div>
  </div>`;
}

function conversationInboxItem(conversation) {
  return `<div class="inbox-item" data-action="view-conversation" data-id="${esc(conversation.id)}" role="button" tabindex="0">
    <div class="item-icon"><svg class="icon"><use href="#i-inbox"/></svg></div>
    <div class="item-main">
      <div class="item-title">${esc(conversation.Contacto || conversation.Email || 'Respuesta')}</div>
      <div class="item-sub">${esc(conversation.Resumen || conversation.Asunto || '')}</div>
    </div>
    <div class="item-actions">${statusPill(conversation.Clasificacion)}</div>
  </div>`;
}

function renderPanel() {
  const activeProducts = state.products.filter((product) => product.Estado === 'Activo');
  const pendingDrafts = state.outbox.filter((draft) => draft.Estado === 'En_revision');
  const pendingConversations = state.conversations.filter((item) => item.Estado === 'Pendiente');
  const activeLeads = state.leads.filter((lead) => !['Descartado', 'OptOut', 'Perdido', 'Ganado'].includes(lead.Estado));
  const pipelineStates = ['Investigado', 'Contactado', 'Respondio', 'Calificado', 'Propuesta', 'Negociacion', 'Ganado'];
  const total = activeLeads.length || 1;
  const mesa = [...pendingDrafts.map(draftInboxItem), ...pendingConversations.map(conversationInboxItem)].slice(0, 5);
  const recentLeads = [...state.leads].sort((a, b) => String(b.Fecha_alta || '').localeCompare(String(a.Fecha_alta || ''))).slice(0, 5);

  return `
    <section class="hero">
      <p class="eyebrow">${esc(todayLong())}</p>
      <h2>Hola, ${esc(getBrand())}.<br />El equipo ya está trabajando.</h2>
      <p>Cargá un producto o revisá lo que los agentes dejaron listo. Vos aprobás; ellos venden.</p>
      <div class="hero-actions">
        <button class="btn primary" data-action="launch" type="button"><svg class="icon"><use href="#i-spark"/></svg> Lanzar agentes</button>
        <button class="btn ghost" data-view="inbox" type="button">Abrir bandeja <svg class="icon"><use href="#i-arrow"/></svg></button>
      </div>
      <div class="hero-meta">
        <div><strong>${activeLeads.length}</strong><span>Leads activos</span></div>
        <div><strong>${pendingDrafts.length}</strong><span>Por aprobar</span></div>
        <div><strong>${pendingConversations.length}</strong><span>Respuestas</span></div>
        <div><strong>${activeProducts.length}</strong><span>Productos activos</span></div>
      </div>
    </section>

    <div class="stat-grid">
      <div class="stat blue">
        <div class="stat-top"><span class="stat-label">Leads activos</span><span class="stat-icon"><svg class="icon"><use href="#i-users"/></svg></span></div>
        <div class="stat-value">${activeLeads.length}</div>
        <div class="stat-sub">${state.leads.length} en total</div>
      </div>
      <div class="stat amber">
        <div class="stat-top"><span class="stat-label">Borradores</span><span class="stat-icon"><svg class="icon"><use href="#i-mail"/></svg></span></div>
        <div class="stat-value">${pendingDrafts.length}</div>
        <div class="stat-sub">Esperando aprobación</div>
      </div>
      <div class="stat green">
        <div class="stat-top"><span class="stat-label">Respuestas</span><span class="stat-icon"><svg class="icon"><use href="#i-inbox"/></svg></span></div>
        <div class="stat-value">${pendingConversations.length}</div>
        <div class="stat-sub">En la mesa de entrada</div>
      </div>
      <div class="stat accent">
        <div class="stat-top"><span class="stat-label">Productos</span><span class="stat-icon"><svg class="icon"><use href="#i-box"/></svg></span></div>
        <div class="stat-value">${activeProducts.length}</div>
        <div class="stat-sub">${state.products.length} en catálogo</div>
      </div>
    </div>

    <div class="grid" style="grid-template-columns: 1.35fr .65fr; gap: 22px; align-items: start;">
      <div>
        <div class="section">
          <div class="section-head">
            <div><h3>Mesa de entrada</h3><p>Lo que necesita tu aprobación hoy.</p></div>
            <button class="link-btn" data-view="inbox" type="button">Ver todo</button>
          </div>
          <div class="inbox-list">
            ${mesa.length ? mesa.join('') : emptyState('inbox', 'Todo al día', 'No hay borradores ni respuestas pendientes.', `<button class="btn ghost small" data-action="launch" type="button">Lanzar agentes</button>`)}
          </div>
        </div>

        <div class="section">
          <div class="section-head">
            <div><h3>Pipeline</h3><p>Dónde está cada oportunidad.</p></div>
          </div>
          <div class="card" style="padding: 20px;">
            <div class="pipeline">
              ${pipelineStates.map((stateName) => {
                const count = state.leads.filter((lead) => lead.Estado === stateName).length;
                const width = Math.round((count / total) * 100);
                return `<div class="pipe-row">
                  <span class="pipe-name">${esc(stateName)}</span>
                  <div class="pipe-track"><div class="pipe-fill" style="width:${Math.max(width, count ? 4 : 0)}%"></div></div>
                  <span class="pipe-value">${count}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div class="section">
          <div class="section-head">
            <div><h3>Productos activos</h3><p>Tu catálogo en venta.</p></div>
            <button class="link-btn" data-view="products" type="button">Ver todos</button>
          </div>
          <div class="product-grid" style="grid-template-columns: 1fr;">
            ${activeProducts.slice(0, 3).map(productCard).join('') || emptyState('box', 'Sin productos activos', 'Cargá un producto y poné Estado = Activo.', `<button class="btn primary small" data-action="new-product" type="button">Cargar producto</button>`)}
          </div>
        </div>

        <div class="section">
          <div class="section-head">
            <div><h3>Últimos leads</h3></div>
            <button class="link-btn" data-view="leads" type="button">Ver todos</button>
          </div>
          <div class="inbox-list">
            ${recentLeads.length ? recentLeads.map((lead) => `<div class="inbox-item" data-action="view-lead" data-id="${esc(lead.id)}" role="button" tabindex="0">
              <div class="item-icon"><span class="score ${scoreClass(lead.Score)}">${esc(lead.Score || '-')}</span></div>
              <div class="item-main">
                <div class="item-title">${esc(lead.Lead || 'Sin nombre')}</div>
                <div class="item-sub">${esc(lead.Nicho || '')} · ${esc(lead.Pais || '')}</div>
              </div>
              <div class="item-actions">${statusPill(lead.Estado)}</div>
            </div>`).join('') : emptyState('users', 'Sin leads todavía', 'Lanzá los agentes para empezar a investigar.')}
          </div>
        </div>
      </div>
    </div>`;
}

function renderProducts() {
  const filters = [
    ['all', 'Todos'],
    ['active', 'Activos'],
    ['draft', 'Borradores']
  ];
  const list = state.products.filter((product) => {
    if (state.filters.products === 'active') return product.Estado === 'Activo';
    if (state.filters.products === 'draft') return product.Estado !== 'Activo';
    return true;
  });

  return `
    <div class="page-head">
      <div><h2>Productos</h2><p>Cargá, editá y activá tu catálogo.</p></div>
      <button class="btn primary" data-action="new-product" type="button"><svg class="icon"><use href="#i-plus"/></svg> Nuevo producto</button>
    </div>
    <div class="row" style="margin-bottom: 18px;">
      ${filters.map(([value, label]) => `<button class="btn small ${state.filters.products === value ? 'dark' : 'ghost'}" data-action="filter-products" data-filter="${value}" type="button">${label}</button>`).join('')}
      <span class="muted small">${list.length} producto${list.length === 1 ? '' : 's'}</span>
    </div>
    ${list.length ? `<div class="product-grid">${list.map(productCard).join('')}</div>` : emptyState('box', 'Sin productos', 'Cargá tu primera lámpara con foto, precio y descripción.', `<button class="btn primary small" data-action="new-product" type="button">Cargar producto</button>`)}`;
}

function renderLeads() {
  const filters = ['all', 'Investigado', 'Contactado', 'Respondio', 'Calificado', 'Propuesta', 'Ganado', 'Perdido', 'OptOut'];
  const list = state.leads.filter((lead) => state.filters.leads === 'all' || lead.Estado === state.filters.leads);
  return `
    <div class="page-head">
      <div><h2>Leads</h2><p>Oportunidades, contactos y próximos pasos.</p></div>
      <span class="pill gray">${state.leads.length} registros</span>
    </div>
    <div class="row" style="margin-bottom: 18px; gap: 7px;">
      ${filters.map((value) => `<button class="btn small ${state.filters.leads === value ? 'dark' : 'ghost'}" data-action="filter-leads" data-filter="${value}" type="button">${value === 'all' ? 'Todos' : value}</button>`).join('')}
    </div>
    ${list.length ? `<div class="table-wrap">
      <table class="lead-table">
        <thead><tr><th>Empresa</th><th>Nicho</th><th>País</th><th>Score</th><th>Estado</th><th>Contacto</th><th>Último</th><th>Próximo paso</th></tr></thead>
        <tbody>
          ${list.map((lead) => `<tr data-action="view-lead" data-id="${esc(lead.id)}">
            <td><div class="lead-name">${esc(lead.Lead || 'Sin nombre')}</div><div class="lead-sub">${esc(lead.Dominio || '')}</div></td>
            <td>${esc(lead.Nicho || '—')}</td>
            <td>${esc(lead.Pais || '—')}</td>
            <td><span class="score ${scoreClass(lead.Score)}">${esc(lead.Score || '-')}</span></td>
            <td>${statusPill(lead.Estado)}</td>
            <td><div class="truncate">${esc(lead.Contacto_nombre || '—')}</div><div class="lead-sub truncate">${esc(lead.Contacto_email || '')}</div></td>
            <td>${dateShort(lead.Ultimo_contacto)}</td>
            <td><div class="truncate">${esc(lead.Proximo_paso || '—')}</div></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : emptyState('users', 'Sin leads en este filtro', 'Lanzá los agentes para generar oportunidades.', `<button class="btn primary small" data-action="launch" type="button">Lanzar agentes</button>`)}`;
}

function renderInbox() {
  const tab = state.filters.inbox;
  const pendingDrafts = state.outbox.filter((draft) => ['En_revision', 'Aprobado'].includes(draft.Estado));
  const sentDrafts = state.outbox.filter((draft) => !['En_revision', 'Aprobado'].includes(draft.Estado));
  const draftList = tab === 'outbox' ? pendingDrafts : sentDrafts;
  const conversations = state.conversations;

  return `
    <div class="page-head">
      <div><h2>Bandeja</h2><p>Borradores y respuestas. Vos aprobás; el sistema envía.</p></div>
      <div class="row">
        <button class="btn ghost" data-action="send-approved" type="button"><svg class="icon"><use href="#i-send"/></svg> Enviar aprobados</button>
        <button class="btn primary" data-action="launch" type="button"><svg class="icon"><use href="#i-spark"/></svg> Lanzar agentes</button>
      </div>
    </div>
    <div class="row" style="margin-bottom: 18px; gap: 7px;">
      <button class="btn small ${tab === 'outbox' ? 'dark' : 'ghost'}" data-action="inbox-tab" data-tab="outbox" type="button">Borradores <span class="pill ${pendingDrafts.length ? 'amber' : 'gray'}" style="margin-left: 6px;">${pendingDrafts.length}</span></button>
      <button class="btn small ${tab === 'conversations' ? 'dark' : 'ghost'}" data-action="inbox-tab" data-tab="conversations" type="button">Respuestas <span class="pill ${conversations.filter((item) => item.Estado === 'Pendiente').length ? 'amber' : 'gray'}" style="margin-left: 6px;">${conversations.filter((item) => item.Estado === 'Pendiente').length}</span></button>
    </div>
    ${tab === 'outbox' ? renderOutbox(draftList) : renderConversations(conversations)}`;
}

function renderOutbox(draftList) {
  if (!draftList.length) return emptyState('mail', 'Sin borradores', 'Lanzá los agentes o aprobá un correo para verlo acá.', `<button class="btn primary small" data-action="launch" type="button">Lanzar agentes</button>`);
  return `<div class="draft-grid">
    ${draftList.map((draft) => `<article class="draft-card">
      <div class="draft-head">
        <div><div class="draft-subject">${esc(draft.Asunto || 'Sin asunto')}</div><div class="draft-to">${esc(draft.Para || '')} · ${esc(draft.Nombre_destinatario || '')}</div></div>
        ${statusPill(draft.Estado)}
      </div>
      <div class="draft-meta">
        <span class="pill gray">${esc(draft.Producto || 'Sin producto')}</span>
        <span class="pill gray">Paso ${esc(draft.Paso ?? '-')}</span>
        <span class="pill gray">${esc(draft.Idioma || '')}</span>
      </div>
      <div class="draft-preview">${esc(stripHtml(draft.Cuerpo_HTML))}</div>
      <div class="draft-actions">
        <button class="btn ghost small" data-action="preview-outbox" data-id="${esc(draft.id)}" type="button">Ver correo</button>
        ${draft.Estado === 'En_revision' ? `<button class="btn primary small" data-action="approve-outbox" data-id="${esc(draft.id)}" type="button"><svg class="icon"><use href="#i-check"/></svg> Aprobar</button>` : ''}
        ${['En_revision', 'Aprobado'].includes(draft.Estado) ? `<button class="btn danger small" data-action="reject-outbox" data-id="${esc(draft.id)}" type="button">Descartar</button>` : ''}
        <button class="btn ghost small" data-action="edit-outbox" data-id="${esc(draft.id)}" type="button"><svg class="icon"><use href="#i-edit"/></svg> Editar</button>
      </div>
    </article>`).join('')}
  </div>`;
}

function renderConversations(conversations) {
  if (!conversations.length) return emptyState('inbox', 'Sin respuestas todavía', 'Cuando alguien responda, la clasificación y el borrador van a aparecer acá.');
  return `<div class="conv-grid">
    ${conversations.map((conversation) => `<article class="conv-card">
      <div class="conv-head">
        <div><div class="conv-person">${esc(conversation.Contacto || conversation.Email || 'Respuesta')}</div><div class="conv-mail">${esc(conversation.Email || '')}</div></div>
        ${statusPill(conversation.Clasificacion)}
      </div>
      <div class="conv-summary">${esc(conversation.Resumen || 'Sin resumen')}</div>
      <div class="conv-draft">${esc(conversation.Borrador_respuesta || 'Sin borrador')}</div>
      <div class="conv-actions">
        <button class="btn ghost small" data-action="view-conversation" data-id="${esc(conversation.id)}" type="button">Ver detalle</button>
        ${conversation.Estado === 'Pendiente' ? `<button class="btn primary small" data-action="approve-reply" data-id="${esc(conversation.id)}" type="button"><svg class="icon"><use href="#i-check"/></svg> Aprobar respuesta</button><button class="btn danger small" data-action="close-conv" data-id="${esc(conversation.id)}" type="button">Cerrar</button>` : ''}
      </div>
    </article>`).join('')}
  </div>`;
}

function renderContent() {
  const filters = ['all', 'Idea', 'Borrador', 'En_revision', 'Aprobado', 'Publicado', 'Descartado'];
  const list = state.content.filter((item) => state.filters.content === 'all' || item.Estado === state.filters.content);
  return `
    <div class="page-head">
      <div><h2>Contenido</h2><p>El plan de redes que los agentes prepararon.</p></div>
      <span class="pill gray">${state.content.length} piezas</span>
    </div>
    <div class="row" style="margin-bottom: 18px; gap: 7px;">
      ${filters.map((value) => `<button class="btn small ${state.filters.content === value ? 'dark' : 'ghost'}" data-action="filter-content" data-filter="${value}" type="button">${value === 'all' ? 'Todas' : value}</button>`).join('')}
    </div>
    ${list.length ? `<div class="content-grid">
      ${list.map((item) => `<article class="content-card">
        <div class="content-top">
          <span class="pill ${item.Plataforma === 'Instagram' ? 'purple' : item.Plataforma === 'TikTok' ? 'blue' : 'gray'}">${esc(item.Plataforma || 'Plataforma')}</span>
          ${statusPill(item.Estado)}
        </div>
        <div class="content-hook">${esc(item.Gancho || item.Titulo || 'Sin gancho')}</div>
        <div class="content-copy">${esc(item.Copy || '')}</div>
        <div class="content-foot">
          <span class="tiny muted">${esc(item.Formato || '')} · ${dateShort(item.Fecha_publicacion)}</span>
          <div class="row">
            <button class="btn ghost small" data-action="view-content" data-id="${esc(item.id)}" type="button">Ver</button>
            ${item.Estado === 'En_revision' ? `<button class="btn primary small" data-action="approve-content" data-id="${esc(item.id)}" type="button">Aprobar</button>` : ''}
          </div>
        </div>
      </article>`).join('')}
    </div>` : emptyState('layers', 'Sin contenido', 'Ejecutá el agente de marketing para generar piezas.')}`;
}

function renderSettings() {
  const configRows = state.configRows.length ? state.configRows : [];
  const make = state.health?.makeConfigured;
  const scenarios = state.makeScenarios;
  const baseName = state.health?.baseName || 'Airtable';
  return `
    <div class="page-head">
      <div><h2>Ajustes</h2><p>Conexiones, configuración y control.</p></div>
      <span class="pill ${state.demo ? 'purple' : 'green'}">${state.demo ? 'Demo' : 'Conectado'}</span>
    </div>
    <div class="settings-grid">
      <div>
        <div class="panel-card" style="margin-bottom: 20px;">
          <h3>Conexión de Airtable</h3>
          <p>La app lee y escribe en tu base. El token queda guardado solo en esta computadora.</p>
          <div class="setting-row">
            <div><div class="label">Base</div><div class="sub">${esc(baseName)}</div></div>
            <span class="pill green">Conectada</span>
          </div>
          <div class="setting-row">
            <div><div class="label">Token</div><div class="sub">Guardado en config.json</div></div>
            <button class="btn ghost small" data-action="disconnect" type="button">Cambiar</button>
          </div>
          <div class="setting-row">
            <div><div class="label">Configuración inicial</div><div class="sub">${configRows.length ? `${configRows.length} filas cargadas` : 'Sin cargar'}</div></div>
            <button class="btn ghost small" data-action="seed-config" type="button">Cargar</button>
          </div>
        </div>

        <div class="panel-card">
          <h3>Configuración de la marca</h3>
          <p>Estos valores los leen los agentes en cada ciclo. Editá con cuidado.</p>
          <div class="config-list">
            ${configRows.map((row) => `<div class="config-row">
              <div class="key">${esc(row.Clave)}</div>
              <textarea data-config-key="${esc(row.Clave)}" data-config-id="${esc(row.id)}" rows="1">${esc(row.Valor || '')}</textarea>
            </div>`).join('') || emptyState('settings', 'Sin configuración', 'Cargá la configuración inicial.')}
          </div>
          <div class="row" style="margin-top: 16px;">
            <button class="btn primary" data-action="save-config" type="button"><svg class="icon"><use href="#i-check"/></svg> Guardar cambios</button>
          </div>
        </div>
      </div>

      <div>
        <div class="panel-card" style="margin-bottom: 20px;">
          <h3>Motor de agentes (Make)</h3>
          <p>Opcional. Conectalo para que el botón “Lanzar agentes” arranque los escenarios al instante.</p>
          ${make ? `<div class="success-banner"><svg class="icon"><use href="#i-check"/></svg><div><strong>Motor conectado.</strong><span>Los cuatro roles están mapeados.</span></div></div>` : `<div class="hint">Sin conectar, los agentes igual corren en sus horarios. El botón de lanzar va a mostrar los pasos para conectarlos.</div>`}
          <div class="make-map"><label>Token de Make</label><input id="make-token" type="password" placeholder="Token de API" autocomplete="off" /></div>
          <div class="make-map"><label>Team ID</label><input id="make-team" type="text" placeholder="Número de equipo" /></div>
          <div class="make-map"><label>Zona</label><select id="make-zone"><option value="us2">us2</option><option value="us1">us1</option><option value="eu1">eu1</option><option value="eu2">eu2</option></select></div>
          <button class="btn dark wide" data-action="make-connect" type="button"><svg class="icon"><use href="#i-refresh"/></svg> Cargar escenarios</button>
          ${scenarios.length ? `<div class="divider" style="margin-top: 22px;"><span>Mapeo</span></div>
            ${['sales', 'send', 'replies', 'marketing'].map((role) => `<div class="make-map"><label>${role === 'sales' ? 'Ventas' : role === 'send' ? 'Envío' : role === 'replies' ? 'Respuestas' : 'Marketing'}</label><select id="map-${role}">${scenarios.map((scenario) => `<option value="${esc(scenario.id)}">${esc(scenario.name)}</option>`).join('')}</select></div>`).join('')}
            <button class="btn primary wide" data-action="make-map" type="button">Guardar mapeo</button>` : ''}
        </div>

        <div class="panel-card">
          <h3>Zona de control</h3>
          <p>Acciones que afectan la conexión local.</p>
          <div class="setting-row"><div><div class="label">Desconectar Airtable</div><div class="sub">Borra el token local, no los datos.</div></div><button class="btn danger small" data-action="disconnect" type="button">Desconectar</button></div>
          <div class="setting-row"><div><div class="label">Recargar datos</div><div class="sub">Vuelve a leer Airtable.</div></div><button class="btn ghost small" data-action="refresh" type="button">Recargar</button></div>
        </div>
      </div>
    </div>`;
}

function render() {
  const titles = {
    panel: ['Panel', 'Tu centro de operaciones'],
    products: ['Productos', 'Cargá, editá y activá tu catálogo'],
    leads: ['Leads', 'Oportunidades y seguimiento'],
    inbox: ['Bandeja', 'Borradores y respuestas'],
    content: ['Contenido', 'Plan de redes'],
    settings: ['Ajustes', 'Conexiones y configuración']
  };
  const [title, subtitle] = titles[state.view] || titles.panel;
  $('#page-title').textContent = title;
  $('#page-subtitle').textContent = state.demo ? 'Modo demo · conectá Airtable para editar' : subtitle;
  $('#brand-name').textContent = state.demo ? 'Lumen Studio' : getBrand();
  $('#today-label').textContent = todayLong();
  $$('.nav-item[data-view]').forEach((item) => item.classList.toggle('active', item.dataset.view === state.view));
  const root = $('#view-root');
  if (state.view === 'panel') root.innerHTML = renderPanel();
  else if (state.view === 'products') root.innerHTML = renderProducts();
  else if (state.view === 'leads') root.innerHTML = renderLeads();
  else if (state.view === 'inbox') root.innerHTML = renderInbox();
  else if (state.view === 'content') root.innerHTML = renderContent();
  else if (state.view === 'settings') root.innerHTML = renderSettings();
  updateNavCount();
}

function updateNavCount() {
  const count = state.outbox.filter((draft) => draft.Estado === 'En_revision').length + state.conversations.filter((item) => item.Estado === 'Pendiente').length;
  const badge = $('#nav-inbox-count');
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

function setView(view) {
  state.view = view;
  render();
  document.body.classList.remove('nav-open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadAll() {
  if (state.demo) return;
  const [products, leads, outbox, conversations, content, configRows, metrics] = await Promise.all([
    api('/api/products'),
    api('/api/leads'),
    api('/api/outbox'),
    api('/api/conversations'),
    api('/api/content'),
    api('/api/config'),
    api('/api/metrics')
  ]);
  state.products = products;
  state.leads = leads;
  state.outbox = outbox;
  state.conversations = conversations;
  state.content = content;
  state.configRows = configRows;
  state.metrics = metrics;
  const connection = $('#connection-pill');
  connection.classList.add('ok');
  $('#connection-label').textContent = 'Airtable conectado';
}

function loadDemo() {
  state.demo = true;
  state.health = { configured: true, baseName: 'Demo', makeConfigured: false, tables: {}, makeScenarios: {} };
  state.makeScenarios = [];
  state.products = [
    { id: 'p1', Producto: 'Lámpara Duna', SKU: 'DUN-01', Estado: 'Activo', Descripcion_corta: 'Luz cálida para salas de estar.', Precio: 145, Moneda: 'USD', Link_ficha: 'https://example.com/duna', Argumentos_venta: 'Pantalla impresa en 3D, luz cálida regulable.', Fotos: [{ url: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=80' }] },
    { id: 'p2', Producto: 'Lámpara Onda', SKU: 'OND-02', Estado: 'Activo', Descripcion_corta: 'Pieza escultórica para recepción.', Precio: 220, Moneda: 'USD', Link_ficha: 'https://example.com/onda', Argumentos_venta: 'Formas orgánicas, acabado mate, edición limitada.', Fotos: [{ url: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=900&q=80' }] },
    { id: 'p3', Producto: 'Lámpara Núcleo', SKU: 'NCL-03', Estado: 'Borrador', Descripcion_corta: 'Concepto de lámpara modular.', Precio: 180, Moneda: 'USD', Link_ficha: '', Argumentos_venta: 'Modular, personalizable en color.', Fotos: [] }
  ];
  state.leads = [
    { id: 'l1', Lead: 'Casa Nativa', Tipo: 'Hotel', Dominio: 'casanativa.com', Pais: 'Argentina', Ciudad: 'Bariloche', Idioma: 'es', Nicho: 'Hotel boutique', Producto_interes: 'Lámpara Duna', Fuente_URL: 'https://casanativa.com', Senal: 'Renovación de 12 habitaciones para la temporada 2027.', Score: 5, Estado: 'Investigado', Contacto_nombre: 'Lucía Pérez', Contacto_cargo: 'Compras', Contacto_email: 'lucia@casanativa.com', Email_estado: 'valid', Fecha_alta: '2026-11-14', Ultimo_contacto: '', Proximo_paso: 'Primer contacto', Notas: '' },
    { id: 'l2', Lead: 'Estudio Norte', Tipo: 'Estudio', Dominio: 'estudionorte.cl', Pais: 'Chile', Ciudad: 'Santiago', Idioma: 'es', Nicho: 'Interiorismo', Producto_interes: 'Lámpara Onda', Fuente_URL: 'https://estudionorte.cl', Senal: 'Proyecto de restaurante con iluminación escultórica.', Score: 5, Estado: 'Contactado', Contacto_nombre: 'Tomás Rojas', Contacto_cargo: 'Director', Contacto_email: 'tomas@estudionorte.cl', Email_estado: 'valid', Fecha_alta: '2026-11-12', Ultimo_contacto: '2026-11-14', Proximo_paso: 'Seguimiento en 4 días', Notas: '' },
    { id: 'l3', Lead: 'Hotel Alma', Tipo: 'Hotel', Dominio: 'hotelalma.mx', Pais: 'México', Ciudad: 'CDMX', Idioma: 'es', Nicho: 'Hotel boutique', Producto_interes: 'Lámpara Núcleo', Fuente_URL: 'https://hotelalma.mx', Senal: 'Nueva ala con 8 suites.', Score: 4, Estado: 'Respondio', Contacto_nombre: 'Mariana Cruz', Contacto_cargo: 'Compras', Contacto_email: 'mariana@hotelalma.mx', Email_estado: 'valid', Fecha_alta: '2026-11-10', Ultimo_contacto: '2026-11-13', Proximo_paso: 'Enviar ficha', Notas: '' },
    { id: 'l4', Lead: 'Casa Bruma', Tipo: 'Restaurante', Dominio: 'casabruma.pt', Pais: 'Portugal', Ciudad: 'Lisboa', Idioma: 'pt', Nicho: 'Restaurante', Producto_interes: 'Lámpara Onda', Fuente_URL: 'https://casabruma.pt', Senal: 'Apertura en marzo 2027.', Score: 3, Estado: 'Investigado', Contacto_nombre: 'Ana Silva', Contacto_cargo: 'Propietaria', Contacto_email: 'ana@casabruma.pt', Email_estado: 'pending', Fecha_alta: '2026-11-13', Ultimo_contacto: '', Proximo_paso: 'Verificar email', Notas: '' },
    { id: 'l5', Lead: 'Maison Verre', Tipo: 'Retail', Dominio: 'maisonverre.fr', Pais: 'Francia', Ciudad: 'París', Idioma: 'fr', Nicho: 'Retail de diseño', Producto_interes: 'Lámpara Duna', Fuente_URL: 'https://maisonverre.fr', Senal: 'Nueva colección de iluminación.', Score: 4, Estado: 'Calificado', Contacto_nombre: 'Claire Dubois', Contacto_cargo: 'Compras', Contacto_email: 'claire@maisonverre.fr', Email_estado: 'valid', Fecha_alta: '2026-11-08', Ultimo_contacto: '2026-11-11', Proximo_paso: 'Propuesta', Notas: '' },
    { id: 'l6', Lead: 'Lumen Studio', Tipo: 'Estudio', Dominio: 'lumenstudio.es', Pais: 'España', Ciudad: 'Madrid', Idioma: 'es', Nicho: 'Interiorismo', Producto_interest: 'Lámpara Onda', Fuente_URL: 'https://lumenstudio.es', Senal: 'Proyecto de oficinas.', Score: 2, Estado: 'Perdido', Contacto_nombre: 'Javier Ruiz', Contacto_cargo: 'Director', Contacto_email: 'javier@lumenstudio.es', Email_estado: 'invalid', Fecha_alta: '2026-11-05', Ultimo_contacto: '2026-11-09', Proximo_paso: 'Descartado', Notas: '' }
  ];
  state.outbox = [
    { id: 'o1', Asunto: 'Iluminación para la renovación de Casa Nativa', Lead: 'Casa Nativa', Para: 'lucia@casanativa.com', Nombre_destinatario: 'Lucía', Cuerpo_HTML: '<p>Hola Lucía,</p><p>Vimos la renovación de las 12 habitaciones de Casa Nativa. Diseñamos y fabricamos lámparas de autor con impresión 3D que pueden adaptarse a la escala y el color de cada espacio.</p><p>¿Te sirve que te comparta la ficha y una idea aplicada a la recepción?</p><p>— Lumen Studio</p><p>Si no querés recibir más mensajes, respondé BAJA.</p>', Idioma: 'es', Producto: 'Lámpara Duna', Paso: 1, Estado: 'En_revision', Respondido: false, Notas: 'Ángulo: renovación 2027.' },
    { id: 'o2', Asunto: 'Propuesta de iluminación escultórica para Estudio Norte', Lead: 'Estudio Norte', Para: 'tomas@estudionorte.cl', Nombre_destinatario: 'Tomás', Cuerpo_HTML: '<p>Hola Tomás,</p><p>La Onda es una pieza escultórica impresa en 3D, pensada para recepciones y barras. Podemos personalizar color y escala.</p><p>¿Querés ver medidas y opciones para el restaurante?</p><p>— Lumen Studio</p><p>Si no querés recibir más mensajes, respondé BAJA.</p>', Idioma: 'es', Producto: 'Lámpara Onda', Paso: 1, Estado: 'Aprobado', Respondido: false, Notas: 'Aprobado para enviar.' },
    { id: 'o3', Asunto: 'Lámparas para la nueva ala del Hotel Alma', Lead: 'Hotel Alma', Para: 'mariana@hotelalma.mx', Nombre_destinatario: 'Mariana', Cuerpo_HTML: '<p>Hola Mariana,</p><p>Para la nueva ala, la Núcleo funciona bien en suites: luz cálida, volumen escultórico y acabado mate.</p><p>¿Te comparto la ficha con medidas y tiempos?</p><p>— Lumen Studio</p><p>Si no querés recibir más mensajes, respondé BAJA.</p>', Idioma: 'es', Producto: 'Lámpara Núcleo', Paso: 1, Estado: 'Respondido', Respondido: true, Notas: '' }
  ];
  state.conversations = [
    { id: 'c1', Asunto: 'Re: Iluminación para la renovación de Casa Nativa', Lead: 'Casa Nativa', Contacto: 'Lucía Pérez', Email: 'lucia@casanativa.com', Canal: 'Email', Direccion: 'Entrante', Clasificacion: 'Pide_precio', Sentimiento: 'Positivo', Resumen: 'Pide precio y plazo para 12 habitaciones.', Borrador_respuesta: 'Hola Lucía, gracias por responder. La Duna arranca en 145 USD por unidad y el plazo depende del color y la cantidad. ¿Querés que te arme una propuesta para 12 unidades con fotos y medidas?', Estado: 'Pendiente', Fecha: '2026-11-15', Notas: '' },
    { id: 'c2', Asunto: 'Re: Propuesta de iluminación escultórica para Estudio Norte', Lead: 'Estudio Norte', Contacto: 'Tomás Rojas', Email: 'tomas@estudionorte.cl', Canal: 'Email', Direccion: 'Entrante', Clasificacion: 'Interesado', Sentimiento: 'Positivo', Resumen: 'Pide medidas y opciones de color.', Borrador_respuesta: 'Hola Tomás, la Onda mide 42 cm de alto y se puede hacer en blanco mate, terracota o arena. ¿Querés que te mande la ficha completa y una imagen en escala?', Estado: 'Pendiente', Fecha: '2026-11-15', Notas: '' },
    { id: 'c3', Asunto: 'Re: Lámparas para la nueva ala del Hotel Alma', Lead: 'Hotel Alma', Contacto: 'Mariana Cruz', Email: 'mariana@hotelalma.mx', Canal: 'Email', Direccion: 'Entrante', Clasificacion: 'Objecion', Sentimiento: 'Neutral', Resumen: 'Le preocupa el plazo de entrega.', Borrador_respuesta: 'Hola Mariana, para 8 suites el plazo estimado es de 3 semanas desde la aprobación del color. Podemos priorizar la producción si el proyecto lo necesita. ¿Te sirve una muestra física?', Estado: 'Pendiente', Fecha: '2026-11-14', Notas: '' }
  ];
  state.content = [
    { id: 'ct1', Titulo: 'Reel: el proceso de impresión', Plataforma: 'Instagram', Formato: 'Reel', Gancho: 'Así nace una lámpara desde cero', Copy: 'Del archivo 3D a la pieza terminada. Cada capa cuenta una historia. Guardá esta idea para tu próximo espacio.', Estado: 'En_revision', Fecha_publicacion: '2026-11-18' },
    { id: 'ct2', Titulo: 'Carrusel: cómo elegir una lámpara escultórica', Plataforma: 'Pinterest', Formato: 'Carrusel', Gancho: '5 preguntas antes de elegir una lámpara', Copy: 'Escala, luz, material, mantenimiento y plazo. Te dejamos la guía rápida para no equivocarte.', Estado: 'Aprobado', Fecha_publicacion: '2026-11-20' },
    { id: 'ct3', Titulo: 'Foto: Duna en recepción', Plataforma: 'Instagram', Formato: 'Foto', Gancho: 'La luz cálida cambia todo', Copy: 'Una recepción de hotel no necesita más muebles: necesita la luz correcta.', Estado: 'Borrador', Fecha_publicacion: '2026-11-22' },
    { id: 'ct4', Titulo: 'Post: por qué impresión 3D', Plataforma: 'LinkedIn', Formato: 'Post', Gancho: 'La impresión 3D no es solo plástico', Copy: 'Es una forma de hacer piezas a medida, con menos desperdicio y más control del diseño.', Estado: 'Idea', Fecha_publicacion: '2026-11-25' }
  ];
  state.configRows = [
    { id: 'cfg1', Clave: 'marca', Valor: 'Lumen Studio' },
    { id: 'cfg2', Clave: 'web', Valor: 'https://lumenstudio.example' },
    { id: 'cfg3', Clave: 'email_remitente', Valor: 'hola@lumenstudio.example' },
    { id: 'cfg4', Clave: 'propuesta_valor', Valor: 'Lámparas de autor impresas en 3D, personalizables en color y escala.' },
    { id: 'cfg5', Clave: 'modo_envio', Valor: 'manual' },
    { id: 'cfg6', Clave: 'limite_borradores_por_ciclo', Valor: '3' }
  ];
  state.metrics = [];
  showShell();
  render();
  toast('Modo demo: explorá la interfaz. Conectá Airtable para usarla de verdad.', 'success');
}

function productFormHtml(product = null) {
  const value = (key, fallback = '') => esc(product?.[key] ?? fallback);
  return `<form id="product-form">
    <div class="form-grid">
      <label class="field full"><span>Nombre del producto</span><input name="Producto" value="${value('Producto')}" placeholder="Lámpara Duna" required /></label>
      <label class="field"><span>SKU</span><input name="SKU" value="${value('SKU')}" placeholder="DUN-01" /></label>
      <label class="field"><span>Estado</span><select name="Estado"><option ${product?.Estado === 'Activo' ? 'selected' : ''}>Activo</option><option ${product?.Estado === 'Borrador' ? 'selected' : ''}>Borrador</option><option ${product?.Estado === 'Pausado' ? 'selected' : ''}>Pausado</option><option ${product?.Estado === 'Agotado' ? 'selected' : ''}>Agotado</option></select></label>
      <label class="field full"><span>Descripción corta</span><input name="Descripcion_corta" value="${value('Descripcion_corta')}" placeholder="Una frase que se entienda en un scroll" /></label>
      <label class="field full"><span>Descripción larga</span><textarea name="Descripcion_larga" placeholder="Material, medidas, uso, cuidados...">${value('Descripcion_larga')}</textarea></label>
      <label class="field"><span>Precio</span><input name="Precio" type="number" min="0" step="1" value="${value('Precio', '0')}" /></label>
      <label class="field"><span>Moneda</span><select name="Moneda"><option ${product?.Moneda === 'USD' ? 'selected' : ''}>USD</option><option ${product?.Moneda === 'EUR' ? 'selected' : ''}>EUR</option><option ${product?.Moneda === 'ARS' ? 'selected' : ''}>ARS</option><option ${product?.Moneda === 'MXN' ? 'selected' : ''}>MXN</option><option ${product?.Moneda === 'CLP' ? 'selected' : ''}>CLP</option></select></label>
      <label class="field"><span>Material</span><input name="Material" value="${value('Material')}" placeholder="PLA / PETG" /></label>
      <label class="field"><span>Medidas</span><input name="Medidas" value="${value('Medidas')}" placeholder="Ø 25 x 42 cm" /></label>
      <label class="field"><span>Colores</span><input name="Colores" value="${value('Colores')}" placeholder="Blanco mate, terracota" /></label>
      <label class="field"><span>Plazo (días)</span><input name="Lead_time_dias" type="number" min="0" value="${value('Lead_time_dias', '7')}" /></label>
      <label class="field"><span>Capacidad semanal</span><input name="Capacidad_semanal" type="number" min="0" value="${value('Capacidad_semanal', '5')}" /></label>
      <label class="field full"><span>Link de la ficha (URL)</span><input name="Link_ficha" value="${value('Link_ficha')}" placeholder="https://..." /></label>
      <label class="field full"><span>Nicho ideal</span><input name="Nicho_ideal" value="${value('Nicho_ideal')}" placeholder="Hoteles boutique, restaurantes de diseño" /></label>
      <label class="field full"><span>Países objetivo</span><input name="Paises_objetivo" value="${value('Paises_objetivo')}" placeholder="Argentina, Chile, México, España" /></label>
      <label class="field full"><span>Argumentos de venta</span><textarea name="Argumentos_venta" placeholder="Diseño propio, fabricación local, personalización...">${value('Argumentos_venta')}</textarea></label>
    </div>
    <div class="dropzone" id="dropzone" style="margin-top: 16px;">
      <svg class="icon"><use href="#i-camera"/></svg>
      <strong>Arrastrá las fotos acá</strong>
      <span>o click para elegir archivos</span>
    </div>
    <input id="photo-input" type="file" accept="image/*" multiple class="hidden" />
    <div class="photo-previews" id="photo-previews"></div>
  </form>`;
}

function openProductModal(product = null) {
  state.pendingPhotos = [];
  openModal({
    title: product ? 'Editar producto' : 'Nuevo producto',
    subtitle: product ? 'Actualizá los datos y las fotos.' : 'Cargá la pieza que querés vender.',
    body: productFormHtml(product),
    footer: `<button class="btn ghost" data-action="close-modal" type="button">Cancelar</button><button class="btn primary" id="save-product" type="button"><svg class="icon"><use href="#i-check"/></svg> ${product ? 'Guardar cambios' : 'Publicar producto'}</button>`,
    wide: true
  });
  const dropzone = $('#dropzone');
  const input = $('#photo-input');
  dropzone.addEventListener('click', () => input.click());
  dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (event) => { event.preventDefault(); dropzone.classList.remove('drag'); handleFiles(event.dataTransfer.files); });
  input.addEventListener('change', () => handleFiles(input.files));
  $('#save-product').addEventListener('click', async () => {
    const form = $('#product-form');
    if (!form.reportValidity()) return;
    const fields = {};
    for (const element of form.elements) {
      if (element.name) fields[element.name] = element.value;
    }
    fields.Precio = fields.Precio ? Number(fields.Precio) : 0;
    fields.Lead_time_dias = fields.Lead_time_dias ? Number(fields.Lead_time_dias) : 0;
    fields.Capacidad_semanal = fields.Capacidad_semanal ? Number(fields.Capacidad_semanal) : 0;
    const button = $('#save-product');
    button.disabled = true;
    button.classList.add('loading');
    try {
      if (state.demo) throw new Error('Demo: conectá Airtable para guardar.');
      const result = product
        ? await api(`/api/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ fields, photos: state.pendingPhotos }) })
        : await api('/api/products', { method: 'POST', body: JSON.stringify({ fields, photos: state.pendingPhotos }) });
      closeModal();
      await loadAll();
      render();
      toast(result.warnings?.length ? 'Producto guardado, pero una foto no se pudo subir. Revisa el campo Fotos en Airtable.' : 'Producto guardado.', result.warnings?.length ? 'error' : 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
    }
  });
}

function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    if (file.size > 8 * 1024 * 1024) {
      toast('La foto es demasiado grande (máximo 8 MB).', 'error');
      continue;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.split(',')[1] || '';
      state.pendingPhotos.push({ filename: file.name, contentType: file.type, data: base64 });
      renderPhotoPreviews();
    };
    reader.readAsDataURL(file);
  }
}

function renderPhotoPreviews() {
  const root = $('#photo-previews');
  if (!root) return;
  root.innerHTML = state.pendingPhotos.map((photo, index) => `<div class="photo-preview">
    <img src="data:${esc(photo.contentType)};base64,${esc(photo.data)}" alt="" />
    <button type="button" data-action="remove-photo" data-index="${index}" aria-label="Quitar"><svg class="icon"><use href="#i-x"/></svg></button>
  </div>`).join('');
}

function openLeadModal(lead) {
  openModal({
    title: lead.Lead || 'Lead',
    subtitle: `${lead.Nicho || ''} · ${lead.Pais || ''}`,
    body: `<dl class="detail-grid">
      <dt>Estado</dt><dd>${statusPill(lead.Estado)}</dd>
      <dt>Score</dt><dd><span class="score ${scoreClass(lead.Score)}">${esc(lead.Score || '-')}</span></dd>
      <dt>Contacto</dt><dd>${esc(lead.Contacto_nombre || '—')} · ${esc(lead.Contacto_cargo || '')}</dd>
      <dt>Email</dt><dd>${esc(lead.Contacto_email || '—')}</dd>
      <dt>Señal</dt><dd>${esc(lead.Senal || '—')}</dd>
      <dt>Fuente</dt><dd>${lead.Fuente_URL ? `<a href="${esc(lead.Fuente_URL)}" target="_blank" rel="noreferrer">${esc(lead.Fuente_URL)}</a>` : '—'}</dd>
      <dt>Último contacto</dt><dd>${dateShort(lead.Ultimo_contacto)}</dd>
      <dt>Próximo paso</dt><dd>${esc(lead.Proximo_paso || '—')}</dd>
      <dt>Notas</dt><dd>${esc(lead.Notas || '—')}</dd>
    </dl>
    <div class="form-grid" style="margin-top: 18px;">
      <label class="field"><span>Estado</span><select id="lead-estado">${['Nuevo', 'Investigado', 'Contactado', 'Respondio', 'Calificado', 'Propuesta', 'Negociacion', 'Ganado', 'Perdido', 'OptOut', 'Descartado'].map((stateName) => `<option ${lead.Estado === stateName ? 'selected' : ''}>${stateName}</option>`).join('')}</select></label>
      <label class="field"><span>Email verificado</span><select id="lead-email-estado">${['pending', 'valid', 'risky', 'invalid', 'unknown'].map((stateName) => `<option ${lead.Email_estado === stateName ? 'selected' : ''}>${stateName}</option>`).join('')}</select></label>
      <label class="field full"><span>Próximo paso</span><input id="lead-proximo" value="${esc(lead.Proximo_paso || '')}" /></label>
      <label class="field full"><span>Notas</span><textarea id="lead-notas">${esc(lead.Notas || '')}</textarea></label>
    </div>`,
    footer: `<button class="btn ghost" data-action="close-modal" type="button">Cerrar</button><button class="btn primary" id="save-lead" type="button"><svg class="icon"><use href="#i-check"/></svg> Guardar</button>`
  });
  $('#save-lead').addEventListener('click', async () => {
    const button = $('#save-lead');
    button.disabled = true;
    try {
      const fields = {
        Estado: $('#lead-estado').value,
        Email_estado: $('#lead-email-estado').value,
        Proximo_paso: $('#lead-proximo').value,
        Notas: $('#lead-notas').value,
        Ultimo_contacto: new Date().toISOString().slice(0, 10)
      };
      await api(`/api/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
      closeModal();
      await loadAll();
      render();
      toast('Lead actualizado.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
}

function openOutboxModal(draft, edit = false) {
  if (edit) {
    openModal({
      title: 'Editar borrador',
      subtitle: draft.Para,
      body: `<label class="field"><span>Asunto</span><input id="draft-subject" value="${esc(draft.Asunto || '')}" /></label>
        <label class="field"><span>Cuerpo HTML</span><textarea id="draft-body" style="min-height: 300px;">${esc(draft.Cuerpo_HTML || '')}</textarea></label>`,
      footer: `<button class="btn ghost" data-action="close-modal" type="button">Cancelar</button><button class="btn primary" id="save-draft" type="button">Guardar</button>`
    });
    $('#save-draft').addEventListener('click', async () => {
      const button = $('#save-draft');
      button.disabled = true;
      try {
        await api(`/api/outbox/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Asunto: $('#draft-subject').value, Cuerpo_HTML: $('#draft-body').value } }) });
        closeModal();
        await loadAll();
        render();
        toast('Borrador guardado.');
      } catch (error) {
        toast(error.message, 'error');
      } finally {
        button.disabled = false;
      }
    });
    return;
  }

  openModal({
    title: 'Vista previa del correo',
    subtitle: `${draft.Para} · ${draft.Producto || ''}`,
    body: `<div class="email-preview">
      <div class="email-preview-head"><div class="subject">${esc(draft.Asunto || 'Sin asunto')}</div><div class="meta">${esc(draft.Nombre_destinatario || draft.Para)} · ${esc(draft.Idioma || '')}</div></div>
      <iframe sandbox="" srcdoc="${esc(draft.Cuerpo_HTML || '')}"></iframe>
    </div>`,
    footer: `<button class="btn ghost" data-action="close-modal" type="button">Cerrar</button>
      <button class="btn ghost" data-action="edit-outbox" data-id="${esc(draft.id)}" type="button">Editar</button>
      ${draft.Estado === 'En_revision' ? `<button class="btn primary" data-action="approve-outbox" data-id="${esc(draft.id)}" type="button"><svg class="icon"><use href="#i-check"/></svg> Aprobar</button>` : ''}`,
    wide: true
  });
}

function openConversationModal(conversation) {
  openModal({
    title: conversation.Contacto || conversation.Email,
    subtitle: conversation.Asunto,
    body: `<div class="row" style="margin-bottom: 14px;">${statusPill(conversation.Clasificacion)}${statusPill(conversation.Sentimiento)}${statusPill(conversation.Estado)}</div>
      <p style="margin: 0 0 10px; color: var(--muted); font-size: 13px;">${esc(conversation.Resumen || '')}</p>
      <div class="conv-draft" style="max-height: 320px;">${esc(conversation.Borrador_respuesta || 'Sin borrador')}</div>`,
    footer: `<button class="btn ghost" data-action="close-modal" type="button">Cerrar</button>
      ${conversation.Estado === 'Pendiente' ? `<button class="btn primary" data-action="approve-reply" data-id="${esc(conversation.id)}" type="button">Aprobar respuesta</button><button class="btn danger" data-action="close-conv" data-id="${esc(conversation.id)}" type="button">Cerrar</button>` : ''}`
  });
}

function openContentModal(item) {
  openModal({
    title: item.Titulo || 'Contenido',
    subtitle: `${item.Plataforma || ''} · ${item.Formato || ''}`,
    body: `<div class="row" style="margin-bottom: 14px;">${statusPill(item.Estado)}<span class="pill gray">${dateShort(item.Fecha_publicacion)}</span></div>
      <div class="content-hook" style="font-size: 18px;">${esc(item.Gancho || '')}</div>
      <div class="conv-draft" style="max-height: 360px;">${esc(item.Copy || '')}</div>`,
    footer: `<button class="btn ghost" data-action="close-modal" type="button">Cerrar</button>${item.Estado === 'En_revision' ? `<button class="btn primary" data-action="approve-content" data-id="${esc(item.id)}" type="button">Aprobar</button>` : ''}`
  });
}

function openMakeHelp() {
  openModal({
    title: 'Conectar el motor de agentes',
    subtitle: 'Opcional, pero el botón “Lanzar agentes” lo necesita.',
    body: `<div class="hint">Sin conectar, los agentes igual corren en sus horarios. Conectar Make solo agrega el botón de arranque inmediato.</div>
      <ol style="line-height: 1.7; padding-left: 20px; font-size: 14px;">
        <li>Entrá a Make y abrí tu perfil.</li>
        <li>En la pestaña <strong>API</strong>, click en <strong>Add token</strong>.</li>
        <li>Marcá los scopes <code>scenarios:read</code>, <code>scenarios:write</code> y <code>scenarios:run</code>.</li>
        <li>Copiá el token y pegalo en <strong>Ajustes &gt; Motor de agentes</strong>.</li>
        <li>Pegá tu <strong>Team ID</strong>. Está en la URL de Make, después de <code>/team/</code>.</li>
        <li>Click en <strong>Cargar escenarios</strong> y asigná cada rol.</li>
      </ol>`,
    footer: `<button class="btn primary" data-action="close-modal" type="button">Entendido</button>`
  });
}

async function launchAgents() {
  if (state.demo) {
    toast('Demo: conectá Airtable y Make para lanzar agentes de verdad.', 'error');
    return;
  }
  if (!state.health?.makeConfigured) {
    openMakeHelp();
    return;
  }
  const button = $('#launch-btn');
  const original = button.innerHTML;
  button.disabled = true;
  button.classList.add('loading');
  button.innerHTML = `<svg class="icon"><use href="#i-refresh"/></svg> Lanzando...`;
  try {
    await api('/api/run/sales', { method: 'POST' });
    toast('Agentes lanzados. El ciclo comercial ya está corriendo.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = original;
  }
}

async function sendApproved() {
  if (state.demo) {
    toast('Demo: conectá Airtable y Make para enviar.', 'error');
    return;
  }
  if (!state.health?.makeConfigured) {
    openMakeHelp();
    return;
  }
  try {
    await api('/api/run/send', { method: 'POST' });
    toast('Envío lanzado. Los correos aprobados salen ahora.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function approveOutbox(id) {
  try {
    await api(`/api/outbox/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Estado: 'Aprobado' } }) });
    await loadAll();
    render();
    toast('Borrador aprobado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function rejectOutbox(id) {
  try {
    await api(`/api/outbox/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Estado: 'Cancelado' } }) });
    await loadAll();
    render();
    toast('Borrador descartado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function approveReply(id) {
  try {
    const conversation = state.conversations.find((item) => item.id === id);
    await api(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Estado: 'Aprobada' } }) });
    const match = state.outbox.find((draft) => draft.Estado === 'En_revision' && (draft.Para === conversation?.Email || draft.Lead === conversation?.Lead));
    if (match) await api(`/api/outbox/${match.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Estado: 'Aprobado' } }) });
    closeModal();
    await loadAll();
    render();
    toast('Respuesta aprobada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function closeConversation(id) {
  try {
    await api(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Estado: 'Cerrada' } }) });
    closeModal();
    await loadAll();
    render();
    toast('Conversación cerrada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function approveContent(id) {
  try {
    await api(`/api/content/${id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Estado: 'Aprobado' } }) });
    closeModal();
    await loadAll();
    render();
    toast('Pieza aprobada.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function seedConfig() {
  const button = $('#seed-config');
  if (button) {
    button.disabled = true;
    button.classList.add('loading');
  }
  try {
    await api('/api/seed-config', { method: 'POST' });
    await loadAll();
    render();
    toast('Configuración inicial cargada.');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    if (button) {
      button.disabled = false;
      button.classList.remove('loading');
    }
  }
}

async function saveConfigRows() {
  try {
    const rows = $$('#view-root [data-config-id]');
    const updates = [];
    for (const textarea of rows) {
      const original = state.configRows.find((row) => row.id === textarea.dataset.configId);
      if (original && original.Valor !== textarea.value) {
        updates.push(api(`/api/config/${original.id}`, { method: 'PATCH', body: JSON.stringify({ fields: { Valor: textarea.value } }) }));
      }
    }
    await Promise.all(updates);
    await loadAll();
    render();
    toast(updates.length ? 'Cambios guardados.' : 'No hay cambios para guardar.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function connectMake() {
  const token = $('#make-token')?.value;
  const teamId = $('#make-team')?.value;
  const zone = $('#make-zone')?.value || 'us2';
  if (!token || !teamId) {
    toast('Pegá el token y el Team ID de Make.', 'error');
    return;
  }
  try {
    const result = await api('/api/make/connect', { method: 'POST', body: JSON.stringify({ token, teamId, zone }) });
    state.makeScenarios = result.scenarios || [];
    state.health = { ...(state.health || {}), makeConfigured: true };
    render();
    toast('Escenarios cargados. Asigná cada rol y guardá el mapeo.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function saveMakeMap() {
  const payload = {};
  for (const role of ['sales', 'send', 'replies', 'marketing']) {
    payload[role] = $(`#map-${role}`)?.value || '';
  }
  try {
    await api('/api/make/map', { method: 'POST', body: JSON.stringify(payload) });
    const health = await api('/api/health');
    state.health = health;
    render();
    toast('Mapeo guardado. El motor está conectado.');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function disconnect() {
  if (!confirm('¿Desconectar Airtable? El token se borra de esta computadora. Los datos de Airtable no se tocan.')) return;
  try {
    await api('/api/disconnect', { method: 'POST' });
    location.reload();
  } catch (error) {
    toast(error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  $('#today-label').textContent = todayLong();
  $('#toggle-token').addEventListener('click', () => {
    const input = $('#token-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  $('#connect-token').addEventListener('click', async () => {
    const button = $('#connect-token');
    const token = $('#token-input').value.trim();
    $('#setup-error').classList.add('hidden');
    if (!token.startsWith('pat')) {
      $('#setup-error').textContent = 'Pegá un token que empiece con pat.';
      $('#setup-error').classList.remove('hidden');
      return;
    }
    button.disabled = true;
    button.classList.add('loading');
    try {
      const result = await api('/api/connect', { method: 'POST', body: JSON.stringify({ token }) });
      const select = $('#base-select');
      select.innerHTML = result.bases.map((base) => `<option value="${esc(base.id)}">${esc(base.name)} (${esc(base.id)})</option>`).join('');
      $('#base-step').classList.remove('hidden');
      $('#seed-step').classList.add('hidden');
      $('#base-step').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      $('#setup-error').textContent = error.message;
      $('#setup-error').classList.remove('hidden');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
    }
  });
  $('#connect-base').addEventListener('click', async () => {
    const button = $('#connect-base');
    const token = $('#token-input').value.trim();
    const baseId = $('#base-select').value;
    $('#base-error').classList.add('hidden');
    button.disabled = true;
    button.classList.add('loading');
    try {
      const result = await api('/api/connect-base', { method: 'POST', body: JSON.stringify({ token, baseId }) });
      if (!result.ok) {
        $('#base-error').innerHTML = `A la base le faltan estas tablas: <strong>${result.missing.map(esc).join(', ')}</strong>. Creá esas tablas o elegí otra base.`;
        $('#base-error').classList.remove('hidden');
        return;
      }
      $('#base-step').classList.add('hidden');
      $('#seed-step').classList.remove('hidden');
      $('#seed-step').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      $('#base-error').textContent = error.message;
      $('#base-error').classList.remove('hidden');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
    }
  });
  $('#seed-config').addEventListener('click', async () => {
    const button = $('#seed-config');
    button.disabled = true;
    button.classList.add('loading');
    try {
      await api('/api/seed-config', { method: 'POST' });
      $('#seed-config').classList.add('hidden');
      $('#enter-app').classList.remove('hidden');
      toast('Configuración inicial cargada.');
    } catch (error) {
      $('#base-error').textContent = error.message;
      $('#base-error').classList.remove('hidden');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
    }
  });
  $('#enter-app').addEventListener('click', async () => {
    state.health = { configured: true, baseName: 'Airtable', makeConfigured: false, tables: {} };
    showShell();
    await loadAll();
    render();
  });
  $('#demo-btn').addEventListener('click', loadDemo);
  $('#help-btn').addEventListener('click', () => {
    openModal({
      title: 'Qué es esto',
      subtitle: 'Tu equipo comercial, en una sola pantalla.',
      body: `<div style="font-size: 14px; line-height: 1.65; color: var(--ink-2);">
        <p><strong>Productos:</strong> cargás la foto, el precio y la descripción. El agente los usa para vender.</p>
        <p><strong>Lanzar agentes:</strong> arranca el motor de prospección. Investiga, califica y deja borradores.</p>
        <p><strong>Bandeja:</strong> aprobás correos y respuestas. Nada se envía sin tu visto bueno.</p>
        <p><strong>Contenido:</strong> el agente de marketing deja piezas para redes.</p>
        <p>Todo queda en Airtable y en esta app. No hay que tocar planillas ni terminal.</p>
      </div>`,
      footer: `<button class="btn primary" data-action="close-modal" type="button">Entendido</button>`
    });
  });

  $('#menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#launch-btn').addEventListener('click', launchAgents);
  $('#refresh-btn').addEventListener('click', async () => {
    const button = $('#refresh-btn');
    button.disabled = true;
    try {
      await loadAll();
      render();
      toast('Datos actualizados.');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener('click', async (event) => {
    const nav = event.target.closest('.nav-item[data-view]');
    if (nav) {
      setView(nav.dataset.view);
      return;
    }
    const viewButton = event.target.closest('[data-view]:not(.nav-item)');
    if (viewButton) {
      setView(viewButton.dataset.view);
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const id = actionEl.dataset.id;

    if (action === 'close-modal') closeModal();
    if (action === 'new-product') openProductModal();
    if (action === 'view-product') {
      const product = state.products.find((item) => item.id === id);
      if (product) openProductModal(product);
    }
    if (action === 'view-lead') {
      const lead = state.leads.find((item) => item.id === id);
      if (lead) openLeadModal(lead);
    }
    if (action === 'preview-outbox') {
      const draft = state.outbox.find((item) => item.id === id);
      if (draft) openOutboxModal(draft);
    }
    if (action === 'edit-outbox') {
      const draft = state.outbox.find((item) => item.id === id);
      if (draft) openOutboxModal(draft, true);
    }
    if (action === 'approve-outbox') await approveOutbox(id);
    if (action === 'reject-outbox') await rejectOutbox(id);
    if (action === 'view-conversation') {
      const conversation = state.conversations.find((item) => item.id === id);
      if (conversation) openConversationModal(conversation);
    }
    if (action === 'approve-reply') await approveReply(id);
    if (action === 'close-conv') await closeConversation(id);
    if (action === 'view-content') {
      const item = state.content.find((content) => content.id === id);
      if (item) openContentModal(item);
    }
    if (action === 'approve-content') await approveContent(id);
    if (action === 'send-approved') await sendApproved();
    if (action === 'launch') await launchAgents();
    if (action === 'filter-products') {
      state.filters.products = actionEl.dataset.filter;
      render();
    }
    if (action === 'filter-leads') {
      state.filters.leads = actionEl.dataset.filter;
      render();
    }
    if (action === 'filter-content') {
      state.filters.content = actionEl.dataset.filter;
      render();
    }
    if (action === 'inbox-tab') {
      state.filters.inbox = actionEl.dataset.tab;
      render();
    }
    if (action === 'save-config') await saveConfigRows();
    if (action === 'make-connect') await connectMake();
    if (action === 'make-map') await saveMakeMap();
    if (action === 'disconnect') await disconnect();
    if (action === 'seed-config') await seedConfig();
    if (action === 'remove-photo') {
      state.pendingPhotos.splice(Number(actionEl.dataset.index), 1);
      renderPhotoPreviews();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      document.body.classList.remove('nav-open');
    }
  });

  $('#modal-root').addEventListener('click', (event) => {
    if (event.target.id === 'modal-root') closeModal();
  });

  try {
    const health = await api('/api/health');
    state.health = health;
    if (health.configured) {
      showShell();
      await loadAll();
      render();
    } else {
      showOnboarding();
    }
  } catch (error) {
    showOnboarding();
  }
});