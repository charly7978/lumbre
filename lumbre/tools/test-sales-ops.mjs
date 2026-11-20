import assert from 'node:assert/strict';
import { buildSalesAgenda } from '../lib/sales-ops.mjs';
const now = new Date('2026-11-20T14:00:00Z').getTime();
const base = (id, fields = {}) => ({ id, productId: 'lamp', stage: 'nuevo', contact: { company: id, email: `${id}@buyer.test` }, drafts: [], quotes: [], messages: [], ...fields });
const tasks = buildSalesAgenda({ now, products: [{ id: 'lamp', name: 'Lámpara Órbita' }], threads: [
  base('respuesta', { stage: 'respondio', score: 91, messages: [{ direction: 'out', at: '2026-11-14T12:00:00Z' }, { direction: 'in', at: '2026-11-19T15:00:00Z' }] }),
  base('cobro', { stage: 'ganado', quotes: [{ id: 'q1', number: 'C-1', status: 'aceptada', total: 250, currency: 'ARS', acceptedAt: '2026-11-16T00:00:00Z', payments: [{ amount: 100 }] }] }),
  base('vencido', { stage: 'contactado', nextFollowUp: '2026-11-18T00:00:00Z', messages: [{ direction: 'out' }] }),
  base('cotizacion', { stage: 'negociando', quotes: [{ id: 'q2', status: 'enviada', sentAt: '2026-11-10T00:00:00Z' }] }),
  base('revision', { stage: 'nuevo', drafts: [{ status: 'revisar', createdAt: '2026-11-18T00:00:00Z' }] }),
  base('oportunidad', { stage: 'interesado' }),
  base('verificacion', { stage: 'nuevo', unverified: true }),
  base('ignorar', { stage: 'perdido', messages: [{ direction: 'in' }] }),
  base('demo', { demo: true, stage: 'respondio', messages: [{ direction: 'in' }] }),
  base('optout', { optOut: true, stage: 'respondio', messages: [{ direction: 'in' }] }),
  base('suprimido', { stage: 'respondio', messages: [{ direction: 'in' }] }),
  base('ganado', { stage: 'ganado', quotes: [{ status: 'aceptada', total: 100, payments: [{ amount: 100 }] }] }),
  base('futuro', { stage: 'contactado', nextFollowUp: '2026-11-28T00:00:00Z', messages: [{ direction: 'out' }] }),
], suppressions: [{ email: 'suprimido@buyer.test' }] });
assert.deepEqual(tasks.tasks.map(x => x.threadId), ['respuesta', 'cobro', 'vencido', 'cotizacion', 'revision', 'oportunidad', 'verificacion']);
assert.equal(tasks.total, 7);
assert.equal(tasks.tasks[1].amount, 150);
assert.equal(tasks.tasks[1].currency, 'ARS');
assert.equal(tasks.tasks[0].productName, 'Lámpara Órbita');
assert.equal(tasks.tasks.filter(x => x.threadId === 'cobro').length, 1);
assert.ok(tasks.policy.includes('no envía'));
const repeat = buildSalesAgenda({ now, threads: [base('duplicada', { stage: 'respondio', messages: [{ direction: 'in' }] }), base('duplicada', { stage: 'respondio', messages: [{ direction: 'in' }] })] });
assert.equal(repeat.total, 1, 'No repetir la misma conversación');
const limited = buildSalesAgenda({ now, threads: [base('a', { stage: 'respondio', messages: [{ direction: 'in' }] }), base('b', { stage: 'respondio', messages: [{ direction: 'in' }] })], limit: 1 });
assert.equal(limited.total, 2);
assert.equal(limited.tasks.length, 1);
console.log('OK sales-ops: respuestas, cobros pendientes, seguimiento, cotizaciones, revisión, opt-out, demo, duplicados y límite.');
