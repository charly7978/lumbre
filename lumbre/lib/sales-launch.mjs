import { productReadiness } from './readiness.mjs';

const RECENT_DAYS = 7;
const BLOCKING_STATUSES = new Set(['queued', 'running', 'done', 'done_with_warnings']);
const ACTIVE_STATUSES = new Set(['queued', 'running']);

export function supervisedMissionPreflight({ products = [], missions = [], settings = {}, aiReady = false, searchInfo = {}, now = Date.now() } = {}) {
  const reasons = [];
  const warnings = [];
  const timestamp = Number(now);
  const markets = (Array.isArray(settings.mission?.markets) ? settings.mission.markets : [])
    .map(value => String(value || '').trim()).filter(Boolean).slice(0, 6);
  if (!aiReady) reasons.push('Falta configurar una IA real en Ajustes → Inteligencia artificial. No se utilizará una demostración.');
  if (!markets.length) reasons.push('Elegí al menos un mercado en Ajustes → Misiones.');
  if (!searchInfo.provider || searchInfo.provider === 'none' || searchInfo.ready !== true) reasons.push('Configurá un motor de búsqueda disponible en Ajustes → Búsqueda.');
  if (searchInfo.provider === 'duckduckgo') warnings.push('La búsqueda pública puede fallar o limitar consultas: verificá los resultados de la misión.');
  if (missions.some(m => !m.demo && ACTIVE_STATUSES.has(m.status))) reasons.push('Ya hay una misión real en ejecución o en cola: terminá esa antes de lanzar otra.');
  const recent = new Set(missions.filter(m => !m.demo && BLOCKING_STATUSES.has(m.status)
    && Number.isFinite(Date.parse(m.createdAt || '')) && timestamp - Date.parse(m.createdAt) >= 0
    && timestamp - Date.parse(m.createdAt) < RECENT_DAYS * 86400000).map(m => m.productId));
  const active = products.filter(p => p && p.id && !p.demo && p.status !== 'archivado');
  const eligible = active.map(product => ({ product, readiness: productReadiness(product) }))
    .filter(item => item.readiness.readyForProspecting && !recent.has(item.product.id))
    .sort((a, b) => b.readiness.score - a.readiness.score
      || Number(b.product.status === 'listo') - Number(a.product.status === 'listo')
      || String(a.product.name || '').localeCompare(String(b.product.name || '')))
    .map(item => ({ id: item.product.id, name: item.product.name, score: item.readiness.score }));
  const unready = active.filter(p => !productReadiness(p).readyForProspecting).length;
  if (!eligible.length) reasons.push(active.length
    ? 'No hay lámparas nuevas listas: completá fichas o esperá a que venza el intervalo de 7 días para repetir la prospección.'
    : 'No hay lámparas activas disponibles.');
  return {
    canStart: !reasons.length, reasons, warnings, markets,
    candidate: eligible[0] || null, candidates: eligible.slice(0, 15),
    eligible: eligible.length, unready, recent: recent.size,
    activeMissions: missions.filter(m => !m.demo && ACTIVE_STATUSES.has(m.status)).length,
    maximumProspects: 8, mode: 'real',
    guarantee: 'Revisión humana obligatoria de cada borrador. Esta acción NO envía mensajes ni confirma ventas.'
  };
}
