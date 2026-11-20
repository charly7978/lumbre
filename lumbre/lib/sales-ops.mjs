/* Agenda comercial determinista. No envía mensajes ni modifica datos. */
import { isSuppressed } from './email.mjs';

const DAY = 86400000;
const ACTIVE_STAGES = new Set(['nuevo', 'contactado', 'respondio', 'interesado', 'negociando']);

function dateValue(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
}
function valueOfPayment(quote) {
  return (Array.isArray(quote?.payments) ? quote.payments : [])
    .reduce((sum, item) => sum + (Number(item.amount) > 0 ? Number(item.amount) : 0), 0);
}

/** One highest-value task per real, contactable conversation; no auto-sends. */
export function buildSalesAgenda({ threads = [], products = [], suppressions = [], now = Date.now(), limit = 15 } = {}) {
  const clock = typeof now === 'number' ? now : new Date(now).getTime();
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const tasks = [];
  const seen = new Set();
  const validSuppression = suppressions.filter((entry) => !entry.demo);

  for (const thread of threads) {
    if (!thread || !thread.id || seen.has(thread.id) || thread.demo || thread.optOut) continue;
    seen.add(thread.id);
    if (isSuppressed(thread.contact?.email, validSuppression, thread.contact?.company)) continue;
    const stage = String(thread.stage || 'nuevo');
    const active = ACTIVE_STAGES.has(stage);
    const name = String(thread.contact?.company || thread.contact?.name || thread.contact?.email || 'Comprador').slice(0, 160);
    const productName = String(productNames.get(thread.productId) || 'Producto sin asignar').slice(0, 160);
    const quotes = Array.isArray(thread.quotes) ? thread.quotes : [];
    const drafts = Array.isArray(thread.drafts) ? thread.drafts : [];
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    const last = messages[messages.length - 1];
    const acceptedDue = quotes.filter((quote) => quote.status === 'aceptada' && Number(quote.total) > valueOfPayment(quote) + 0.005)
      .sort((a, b) => (dateValue(a.acceptedAt) || 0) - (dateValue(b.acceptedAt) || 0))[0];
    const quoteSent = quotes.filter((quote) => quote.status === 'enviada' && dateValue(quote.sentAt) !== null)
      .sort((a, b) => dateValue(a.sentAt) - dateValue(b.sentAt))[0];
    const dueAt = dateValue(thread.nextFollowUp);
    const review = drafts.filter((draft) => draft.status === 'revisar');
    const candidate = { threadId: thread.id, company: name, productName, stage, score: Math.max(0, Math.min(100, Number(thread.score) || 0)), category: '', title: '', detail: '', priority: 0, dueAt: null };

    if (active && last?.direction === 'in') {
      Object.assign(candidate, { category: 'respuesta', title: 'Responder al comprador', detail: 'El último mensaje registrado llegó del comprador. Revisá su consulta y prepará la respuesta.', priority: 100, dueAt: last.at || null });
    } else if (acceptedDue) {
      const remaining = Math.round(Math.max(0, Number(acceptedDue.total) - valueOfPayment(acceptedDue)) * 100) / 100;
      Object.assign(candidate, { category: 'cobro', title: 'Comprobar saldo pendiente', detail: `Cotización ${acceptedDue.number || acceptedDue.id}: saldo informado pendiente. Confirmá la acreditación manualmente; no se verificó en el banco.`, priority: 88, dueAt: acceptedDue.acceptedAt || acceptedDue.createdAt || null, amount: remaining, currency: acceptedDue.currency || 'USD' });
    } else if (active && dueAt !== null && dueAt <= clock && messages.some((m) => m.direction === 'out')) {
      Object.assign(candidate, { category: 'seguimiento', title: 'Seguimiento vencido', detail: 'Hay una fecha de seguimiento vencida. Revisá la conversación antes de contactar nuevamente.', priority: 85, dueAt: thread.nextFollowUp });
    } else if (active && quoteSent && clock - dateValue(quoteSent.sentAt) >= 3 * DAY) {
      Object.assign(candidate, { category: 'cotizacion', title: 'Revisar cotización sin cerrar', detail: `Cotización ${quoteSent.number || quoteSent.id} marcada como enviada hace al menos 3 días. Comprobá si hubo respuesta antes de seguir.`, priority: 78, dueAt: quoteSent.sentAt });
    } else if (active && review.length) {
      Object.assign(candidate, { category: 'revision', title: 'Aprobar o corregir propuesta', detail: `${review.length} borrador${review.length === 1 ? '' : 'es'} pendiente${review.length === 1 ? '' : 's'} de revisión; no se enviará automáticamente desde esta agenda.`, priority: 70, dueAt: review[0].createdAt || null });
    } else if (active && ['interesado', 'negociando', 'respondio'].includes(stage) && !quotes.some((quote) => ['enviada', 'aceptada'].includes(quote.status))) {
      Object.assign(candidate, { category: 'oportunidad', title: 'Preparar siguiente propuesta', detail: 'Hay una conversación activa sin cotización enviada o aceptada. Revisá el próximo paso comercial.', priority: 60, dueAt: thread.lastActivityAt || thread.updatedAt || null });
    } else if (active && thread.unverified) {
      Object.assign(candidate, { category: 'verificacion', title: 'Verificar datos del comprador', detail: 'El contacto figura sin verificar. Comprobá su identidad y pertinencia antes de enviar propuestas.', priority: 50, dueAt: thread.updatedAt || null });
    } else {
      continue;
    }
    tasks.push(candidate);
  }

  tasks.sort((a, b) => b.priority - a.priority || (dateValue(a.dueAt) || clock) - (dateValue(b.dueAt) || clock) || b.score - a.score || a.threadId.localeCompare(b.threadId));
  const counts = tasks.reduce((acc, task) => { acc[task.category] = (acc[task.category] || 0) + 1; return acc; }, {});
  return { total: tasks.length, counts, tasks: tasks.slice(0, Math.max(1, Math.min(50, Number(limit) || 15))), policy: 'Agenda sugerida para revisión humana: no envía mensajes, no acredita pagos y excluye demos y contactos suprimidos.' };
}
