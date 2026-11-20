import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
// La caché de búsqueda se persiste en disco junto a los datos; los tests
// nunca deben tocar el directorio real del dueño.
process.env.LUCIAN_DATA_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), 'lucian-cache-test-'));
import { Store } from '../lib/store.mjs';
import { clearSearchCache, searchWebDetailed } from '../lib/search.mjs';
import { Outbox, buildFollowUp } from '../lib/outbox.mjs';
import { ensureCompliance } from '../lib/email.mjs';

let passed = 0;
const dirs = [];
function ok(condition, label, detail = '') {
  if (!condition) {
    console.error(`FALLO: ${label}${detail ? ` ”” ${detail}` : ''}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  passed += 1;
  console.log(`OK ${label}`);
}

async function freshStore() {
  const dir = path.join(os.tmpdir(), `lucian-scale-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  dirs.push(dir);
  const store = new Store(dir);
  await store.init();
  return store;
}

/* 1. La caché de proveedores pagos evita repetir la misma búsqueda.
   Una campaña de 20 productos hace las mismas consultas de mercado:
   sin caché, Tavily cobra 20 veces por el mismo dato. */
{
  clearSearchCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls += 1;
    if (!String(url).includes('api.tavily.com')) throw new Error(`fetch inesperado: ${url}`);
    return new Response(JSON.stringify({
      results: [{ title: 'Tienda de diseño', url: 'https://tienda.test', content: 'Lámparas de autor' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const settings = { search: { provider: 'tavily', apiKey: 'tvly-test', cacheHours: 24 } };
    const first = await searchWebDetailed(settings, 'tiendas de diseño Madrid', { count: 5, searchDepth: 'advanced' });
    const second = await searchWebDetailed(settings, 'tiendas de diseño Madrid', { count: 5, searchDepth: 'advanced' });
    ok(calls === 1, 'la segunda búsqueda idéntica sale de caché', `llamadas: ${calls}`);
    ok(second.cached === true, 'la respuesta cacheada se marca como tal');
    ok(first.results.length === 1 && second.results[0].url === 'https://tienda.test', 'la caché conserva los resultados');
    const other = await searchWebDetailed(settings, 'tiendas de diseño Barcelona', { count: 5, searchDepth: 'advanced' });
    ok(calls === 2 && other.cached !== true, 'una consulta distinta sí consulta al proveedor');
    ok(!JSON.stringify(other.results).includes('Madrid'), 'no mezcla resultados de otra consulta');
  } finally {
    globalThis.fetch = originalFetch;
    clearSearchCache();
  }
}

/* 2. El piloto automático agenda, envía una sola vez y marca el borrador. */
{
  const store = await freshStore();
  await store.saveSettings({
    email: { provider: 'resend', resendKey: 're_test', from: 'Lucian <hola@lucian.test>', dailyLimit: 50, warmup: false, autopilot: true, autopilotSpacingMin: 5 },
  });
  const product = { id: 'prd_scale', name: 'Aurora 01' };
  const mission = { id: 'mis_scale', name: 'Campaña', demo: false, status: 'done' };
  const draft = { id: 'drf_scale', channel: 'email', status: 'listo', subject: 'Aurora', body: 'Hola' };
  const thread = {
    id: 'thr_scale', missionId: mission.id, productId: product.id, demo: false, stage: 'nuevo',
    contact: { company: 'Luz de Autor', email: 'compras@luzdeautor.test' }, drafts: [draft], messages: [],
  };
  await store.set('products', [product]);
  await store.set('missions', [mission]);
  await store.set('threads', [thread]);

  const delivered = [];
  const outbox = new Outbox({
    store,
    deliver: async ({ threadId, draftId }) => {
      delivered.push({ threadId, draftId });
      const current = store.get('threads').find((item) => item.id === threadId);
      const currentDraft = current.drafts.find((item) => item.id === draftId);
      currentDraft.status = 'enviado';
      current.messages.push({ direction: 'out', at: new Date().toISOString(), subject: 'Aurora' });
      await store.set('threads', store.get('threads'));
    },
  });

  const queued = await outbox.scheduleMission(mission);
  ok(queued.queued === 1, 'agenda el borrador listo de la misión');
  ok(outbox.status().pending === 1, 'la cola muestra un pendiente');
  ok(await outbox.scheduleMission(mission) && outbox.status().pending === 1, 'no duplica el mismo borrador');

  await outbox.processQueue(store.settings());
  ok(delivered.length === 1 && delivered[0].draftId === draft.id, 'envía el borrador agendado');
  ok(outbox.items()[0].status === 'sent', 'el elemento queda marcado como enviado');
  ok(thread.drafts[0].status === 'enviado', 'el borrador queda enviado en la conversación');

  await outbox.processQueue(store.settings());
  ok(delivered.length === 1, 'no vuelve a enviar lo ya enviado');
}

/* 3. Una supresión detiene la cola antes de tocar al contacto. */
{
  const store = await freshStore();
  await store.saveSettings({
    email: { provider: 'webhook', webhookUrl: 'https://hook.test/send', from: 'Lucian <hola@lucian.test>', dailyLimit: 50, warmup: false, autopilot: true },
  });
  const draft = { id: 'drf_sup', channel: 'email', status: 'listo', subject: 'Hola', body: 'Hola' };
  const thread = {
    id: 'thr_sup', missionId: 'mis_sup', demo: false, stage: 'nuevo',
    contact: { company: 'Casa Sup', email: 'hola@casasup.test' }, drafts: [draft], messages: [],
  };
  await store.set('threads', [thread]);
  await store.set('suppressions', [{ id: 'sup_1', email: 'hola@casasup.test', reason: 'pidió baja' }]);
  let delivered = 0;
  const outbox = new Outbox({ store, deliver: async () => { delivered += 1; } });
  await outbox.enqueueDraft(thread, draft);
  await outbox.save();
  await outbox.processQueue(store.settings());
  ok(delivered === 0, 'no envía a un contacto suprimido');
  ok(outbox.items()[0].status === 'cancelled', 'cancela el elemento con explicación');
  ok(/no contactar/i.test(outbox.items()[0].error || ''), 'explica por qué se canceló');
}

/* 4. Seguimientos: se preparan una vez, sin duplicar y sin precio viejo. */
{
  const store = await freshStore();
  await store.saveSettings({ email: { provider: 'manual', followUps: true } });
  const product = { id: 'prd_follow', name: 'Siri Velador' };
  const mission = { id: 'mis_follow', demo: false, artifacts: { outreach: { secuencia: [] } } };
  const sentAt = new Date(Date.now() - 5 * 86400000).toISOString();
  const thread = {
    id: 'thr_follow', missionId: mission.id, productId: product.id, demo: false, stage: 'contactado',
    contact: { company: 'Luz de Autor', email: 'compras@luzdeautor.test', country: 'España' },
    drafts: [{ id: 'drf_first', channel: 'email', status: 'enviado', subject: 'Siri para tu tienda', body: 'Hola', source: 'mision' }],
    messages: [{ direction: 'out', at: sentAt, subject: 'Siri para tu tienda' }],
    followUpCount: 0,
    nextFollowUp: new Date(Date.now() - 86400000).toISOString(),
  };
  await store.set('products', [product]);
  await store.set('missions', [mission]);
  await store.set('threads', [thread]);

  const outbox = new Outbox({ store, deliver: async () => {} });
  await outbox.maybeFollowUps(store.settings());
  const follow = thread.drafts.find((item) => item.source === 'seguimiento');
  ok(Boolean(follow), 'crea el seguimiento vencido');
  ok(follow.status === 'revisar', 'sin piloto automático queda para revisar');
  ok(thread.nextFollowUp === null, 'apaga el disparador hasta que se envíe');
  ok(!/USD|\$|€|\d+\s*(d[oó]lares|euros)/i.test(follow.body), 'el seguimiento no repite precios viejos');

  await store.setMeta({ lastFollowUpScan: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() });
  await outbox.maybeFollowUps(store.settings());
  ok(thread.drafts.filter((item) => item.source === 'seguimiento').length === 1, 'no duplica el seguimiento pendiente');
}

/* 5. BuildFollowUp elige idioma y no promete nada que no corresponda. */
{
  const esThread = { contact: { country: 'España' }, drafts: [{ language: 'es' }], messages: [{ direction: 'out', subject: 'Hola' }] };
  const enThread = { contact: { country: 'Estados Unidos' }, drafts: [{ language: 'en' }], messages: [{ direction: 'out', subject: 'Hello' }] };
  const es = buildFollowUp(esThread, { name: 'Siri' }, { artifacts: { outreach: { secuencia: [] } } });
  const en = buildFollowUp(enThread, { name: 'Siri' }, { artifacts: { outreach: { secuencia: [] } } });
  ok(/^Hola/.test(es.body) && /^Hi/.test(en.body), 'el seguimiento respeta el idioma del hilo');
  ok(es.subject.startsWith('Re: ') && en.subject.startsWith('Re: '), 'el asunto se mantiene en el mismo hilo');
}

/* 7. La cola automática no toca conversaciones en etapas que no admiten
   envío: alguien que respondió o ya está interesado lo lleva una persona;
   alguien perdido no se vuelve a molestar. Abarca la encolación y también
   la cancelación en el momento del envío si la etapa cambió después. */
{
  const store = await freshStore();
  await store.saveSettings({
    email: { provider: 'resend', resendKey: 're_test', from: 'Lucian <hola@lucian.test>', dailyLimit: 50, warmup: false, autopilot: true, autopilotSpacingMin: 5 },
  });
  const mkDraft = (id) => ({ id, channel: 'email', status: 'listo', subject: 'Hola', body: 'Hola' });
  const mkThread = (id, stage) => ({
    id, stage, missionId: 'mis_stage', demo: false,
    contact: { company: `Casa ${id}`, email: `hola${id}@casadeprueba.test` },
    drafts: [mkDraft(`drf_${id}`)], messages: [],
  });
  const threads = [mkThread('a', 'interesado'), mkThread('b', 'respondio'), mkThread('c', 'ganado'), mkThread('d', 'perdido')];
  await store.set('threads', threads);
  const outbox = new Outbox({ store, deliver: async () => { throw new Error('no debería enviar'); } });
  for (const thread of threads) {
    const item = await outbox.enqueueDraft(thread, thread.drafts[0]);
    ok(item === null, `no encola en etapa ${thread.stage}`);
  }

  // La etapa puede cambiar entre la encolación y el envío.
  const fresh = mkThread('e', 'nuevo');
  await store.set('threads', [...store.get('threads'), fresh]);
  const item = await outbox.enqueueDraft(fresh, fresh.drafts[0]);
  ok(Boolean(item), 'encola mientras la etapa admite contacto');
  fresh.stage = 'interesado';
  await store.set('threads', store.get('threads').map((t) => (t.id === fresh.id ? fresh : t)));
  let delivered = 0;
  outbox.deliver = async () => { delivered += 1; };
  await outbox.processQueue(store.settings());
  ok(delivered === 0, 'cancela en el envío si la etapa cambió después de encolar');
  ok(outbox.items().at(-1).status === 'cancelled', 'el elemento queda cancelado');
}

/* 8. Espaciado global: como máximo un envío por intervalo configurado,
   incluso si hay varios borradores vencidos al mismo tiempo (reinicio,
   misiones que terminan juntas). Si el cupo se agotó, el envío espera. */
{
  const store = await freshStore();
  await store.saveSettings({
    email: { provider: 'resend', resendKey: 're_test', from: 'Lucian <hola@lucian.test>', dailyLimit: 50, warmup: false, autopilot: true, autopilotSpacingMin: 10 },
  });
  const mkThread = (id) => ({
    id, stage: 'nuevo', missionId: 'mis_spacing', demo: false,
    contact: { company: `Casa ${id}`, email: `hola${id}@espaciado.test` },
    drafts: [{ id: `drf_${id}`, channel: 'email', status: 'listo', subject: 'Hola', body: 'Hola' }], messages: [],
  });
  const threads = [mkThread('uno'), mkThread('dos')];
  await store.set('threads', threads);
  let delivered = 0;
  const outbox = new Outbox({ store, deliver: async () => { delivered += 1; } });
  for (const thread of threads) await outbox.enqueueDraft(thread, thread.drafts[0]);
  await outbox.save();

  // Un envío reciente bloquea el siguiente aunque haya vencidos.
  await store.setMeta({ lastOutboxSendAt: new Date().toISOString() });
  const blocked = await outbox.processQueue(store.settings());
  ok(blocked === 0 && delivered === 0, 'un envío reciente impone el espaciado global');

  // Pasado el intervalo, sale de a uno (MAX_PER_TICK), nunca en ráfaga.
  await store.setMeta({ lastOutboxSendAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
  await outbox.processQueue(store.settings());
  ok(delivered === 1, 'pasado el espaciado sale un solo envío por corrida');
  ok(outbox.items().filter((entry) => entry.status === 'pending').length === 1, 'el segundo sigue esperando su turno');
  ok(Date.parse(store.get('meta').lastOutboxSendAt) > Date.now() - 60 * 1000, 'registra el momento del último envío');
  const after = await outbox.processQueue(store.settings());
  ok(after === 0 && delivered === 1, 'y el siguiente tick respeta el nuevo espaciado');
}

/* 10. Postventa: al marcar ganado, Lucian prepara los tres toques
   (día 3 agradecimiento, día 30 feedback, día 90 reorden). Sin piloto
   quedan Por aprobar; los suprimidos nunca reciben nada. */
{
  const store = await freshStore();
  await store.saveSettings({ email: { provider: 'manual', followUps: true } });
  const product = { id: 'prd_post', name: 'Siri Velador' };
  const mission = { id: 'mis_post', demo: false, status: 'done', artifacts: { outreach: { secuencia: [] } } };
  const mkThread = (id, overrides = {}) => ({
    id, stage: 'ganado', missionId: mission.id, productId: product.id, demo: false,
    contact: { company: `Casa ${id}`, email: `hola${id}@postventa.test`, country: 'España' },
    drafts: [], messages: [{ direction: 'out', at: new Date(Date.now() - 40 * 86400000).toISOString(), subject: 'Siri' }],
    postSaleCount: 0,
    postSaleAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    ...overrides,
  });
  await store.set('products', [product]);
  await store.set('missions', [mission]);
  await store.set('threads', [
    mkThread('uno'),                                // toque 1 vencido
    mkThread('dos', { stage: 'interesado' }),       // no es ganado: nada
    mkThread('tres', { postSaleAt: null }),         // sin ancla: usa updatedAt
    mkThread('cuatro', { postSaleAt: new Date().toISOString() }), // día 3 aún no vencido
  ]);
  store.get('threads').find((t) => t.id === 'tres').updatedAt = new Date(Date.now() - 40 * 86400000).toISOString();

  const outbox = new Outbox({ store, deliver: async () => {} });
  await outbox.maybePostSale(store.settings());
  const draftsOf = (id) => ((store.get('threads') || []).find((t) => t.id === id)?.drafts || []).filter((d) => d.source === 'postventa');
  const threads = store.get('threads');
  ok(draftsOf('uno').length === 1, 'prepara el toque 1 vencido');
  ok(draftsOf('uno')[0].status === 'revisar', 'sin piloto queda Por aprobar');
  ok(draftsOf('uno')[0].postSaleStep === 1, 'el toque 1 es de agradecimiento');
  ok(!/USD|\$|€|descuento|\d+\s*%/i.test(draftsOf('uno')[0].body), 'sin precios ni descuentos');
  ok(draftsOf('dos').length === 0, 'no escribe a quien no compró');
  ok(draftsOf('tres').length === 1, 'un ganado sin ancla usa la última actividad');
  ok(Boolean(threads.find((t) => t.id === 'tres').postSaleAt), 'y fija el ancla en ese momento');
  ok(draftsOf('cuatro').length === 0, 'respeta el día 3');
  ok(threads.find((t) => t.id === 'uno').postSaleCount === 0, 'el contador sube recién con el envío');

  await store.setMeta({ lastFollowUpScan: new Date(0).toISOString() });
  await outbox.maybePostSale(store.settings());
  ok(draftsOf('uno').length === 1, 'no duplica el toque mientras está pendiente');

  // Supresión: un ganado que pidió baja no recibe nada.
  await store.set('suppressions', [{ id: 'sup_post', email: 'holacuatro@postventa.test' }]);
  threads.find((t) => t.id === 'cuatro').postSaleAt = new Date(Date.now() - 10 * 86400000).toISOString();
  await store.set('threads', threads);
  await outbox.maybePostSale(store.settings());
  ok(draftsOf('cuatro').length === 0, 'un ganado suprimido no recibe postventa');

  // Toques 2 y 3 según el calendario (día 30 / día 90).
  for (const [count, daysAgo, step] of [[1, 35, 2], [2, 95, 3]]) {
    const target = mkThread(`paso${step}`, { postSaleCount: count, postSaleAt: new Date(Date.now() - daysAgo * 86400000).toISOString(), drafts: [] });
    await store.set('threads', [...store.get('threads'), target]);
    await outbox.maybePostSale(store.settings());
    const made = draftsOf(target.id);
    ok(made.length === 1 && made[0].postSaleStep === step, `prepara el toque ${step} cuando corresponde`);
  }
  // Secuencia agotada: tres toques y nada más.
  const doneThread = mkThread('agotado', { postSaleCount: 3, postSaleAt: new Date(Date.now() - 120 * 86400000).toISOString(), drafts: [] });
  await store.set('threads', [...store.get('threads'), doneThread]);
  await outbox.maybePostSale(store.settings());
  ok(draftsOf('agotado').length === 0, 'la secuencia cierra en el toque 3');
}

/* 12. Postventa con piloto: se encola y se envía (la guarda de etapa
   permite ganado para este caso); si el cliente vuelve a escribir antes
   del envío, el toque se cancela y lo toma una persona. */
{
  const store = await freshStore();
  await store.saveSettings({
    email: { provider: 'resend', resendKey: 're_test', from: 'Lucian <hola@lucian.test>', dailyLimit: 50, warmup: false, autopilot: true, autopilotSpacingMin: 5 },
  });
  const product = { id: 'prd_ap', name: 'Siri Velador' };
  const mission = { id: 'mis_ap', demo: false, status: 'done', artifacts: { outreach: { secuencia: [] } } };
  const thread = {
    id: 'thr_ap', stage: 'ganado', missionId: mission.id, productId: product.id, demo: false,
    contact: { company: 'Casa Aprobada', email: 'compras@casaaprobada.test', country: 'España' },
    drafts: [], messages: [{ direction: 'out', at: new Date(Date.now() - 40 * 86400000).toISOString(), subject: 'Siri' }],
    postSaleCount: 0, postSaleAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  };
  await store.set('products', [product]);
  await store.set('missions', [mission]);
  await store.set('threads', [thread]);

  const delivered = [];
  const outbox = new Outbox({
    store,
    deliver: async ({ threadId, draftId }) => {
      delivered.push({ threadId, draftId });
      const current = store.get('threads').find((t) => t.id === threadId);
      const draft = current.drafts.find((d) => d.id === draftId);
      draft.status = 'enviado';
      current.messages.push({ direction: 'out', at: new Date().toISOString(), subject: draft.subject });
      await store.set('threads', store.get('threads'));
    },
  });
  await outbox.maybePostSale(store.settings());
  ok(outbox.status().pending === 1, 'el toque se encola con el piloto activo');
  ok(outbox.items()[0].kind === 'postventa', 'queda marcado como postventa');
  await outbox.processQueue(store.settings());
  ok(delivered.length === 1, 'el piloto envía la postventa a un cliente ganado');

  // Si el cliente escribe entre la encolación y el envío, no sale.
  const thread2 = {
    id: 'thr_ap2', stage: 'ganado', missionId: mission.id, productId: product.id, demo: false,
    contact: { company: 'Casa Cambio', email: 'compras@casacambio.test', country: 'España' },
    drafts: [{ id: 'drf_ap2', channel: 'email', status: 'listo', subject: 'Re: Siri', body: 'Hola', source: 'postventa' }],
    messages: [],
    postSaleAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  };
  await store.set('threads', [...store.get('threads'), thread2]);
  const item2 = await outbox.enqueueDraft(thread2, thread2.drafts[0], { kind: 'postventa' });
  ok(Boolean(item2), 'encola el segundo toque');
  thread2.stage = 'respondio';
  await store.set('threads', store.get('threads').map((t) => (t.id === thread2.id ? thread2 : t)));
  // El espaciado global (5 min) sigue vigente desde el primer envío;
  // pasamos la hora para que el segundo elemento sí sea evaluado.
  await store.setMeta({ lastOutboxSendAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() });
  await outbox.processQueue(store.settings());
  ok(outbox.items().find((entry) => entry.id === item2.id).status === 'cancelled', 'si volvió a escribir, la postventa se cancela');
  ok(delivered.length === 1, 'y no sale ningún correo');
}

/* 11. Cumplimiento: la baja y la dirección física viajan en cada correo. */
{
  const text = ensureCompliance('Hola, te paso la ficha.', {
    brand: { name: 'Lucian', maker: 'Carlos', address: 'Calle 123, Rosario', website: 'https://lucian.test' },
    email: {},
  });
  ok(/respondé BAJA/i.test(text), 'incluye una vía de baja');
  ok(text.includes('Calle 123, Rosario'), 'incluye la dirección física');
  ok(text.includes('https://lucian.test'), 'incluye el sitio de la marca');
}

for (const dir of [...dirs, process.env.LUCIAN_DATA_DIR]) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
console.log(`\n${passed} comprobaciones de escala OK`);
