const base = 'http://127.0.0.1:4399';

async function waitUp() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return r.json();
    } catch { /* arranca */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server not up');
}

async function api(path, options = {}) {
  const r = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) {
    const error = new Error(`${r.status} ${data?.error || text}`);
    error.status = r.status;
    throw error;
  }
  return data;
}

async function expectStatus(label, status, fn) {
  try {
    await fn();
    console.log(label, 'FAILED: no error');
    process.exitCode = 1;
  } catch (e) {
    console.log(label, e.status === status ? 'OK' : `FAILED: ${e.message}`);
    if (e.status !== status) process.exitCode = 1;
  }
}

const health = await waitUp();
console.log('health', health);
await api('/api/demo/seed', { method: 'POST' });
let state = await api('/api/state');
console.log('counts', state.counts, 'flags', state.flags);

/* 1. Misión demo y creación de hilos. */
const product = state.products[0];
const created = await api('/api/missions', {
  method: 'POST',
  body: JSON.stringify({ productId: product.id, mode: 'demo', depth: 'rapida', markets: ['España', 'México'], notes: 'Prueba automatizada' }),
});
console.log('mission created', created.mission.id, created.mission.steps.length);
let mission;
for (let i = 0; i < 100; i += 1) {
  mission = (await api(`/api/missions/${created.mission.id}`)).mission;
  if (['done', 'done_with_warnings', 'error', 'cancelled'].includes(mission.status)) break;
  await new Promise((r) => setTimeout(r, 150));
}
console.log('mission final', mission.status, mission.progress, Object.keys(mission.artifacts), mission.error);
const missionThreads = (await api(`/api/missions/${mission.id}`)).threads;
console.log('threads created for mission', missionThreads.length);
state = await api('/api/state');
console.log('counts after', state.counts);

/* 2. Webhook: cabecera de proxy sin token debe rechazarse. */
await expectStatus('webhook con x-forwarded-for sin token', 403, () => api('/api/webhooks/email', {
  method: 'POST',
  headers: { 'x-forwarded-for': '203.0.113.7' },
  body: JSON.stringify({ from: 'Marta <marta@luzdeautor.test>', to: 'hola@lumbre.test', subject: 'Consulta', text: 'Hola, me interesa.' }),
}));

/* 2b. Preparación comercial y seguridad de WhatsApp. */
const productsAudit = await api('/api/products');
if (!productsAudit.products.length || typeof productsAudit.products[0].readiness?.score !== 'number') {
  throw new Error('La preparación comercial no está disponible en el catálogo.');
}
const sampleProduct = productsAudit.products[0];
const changedProduct = await api(`/api/products/${sampleProduct.id}`, {
  method: 'PUT',
  body: JSON.stringify({ capacityPerWeek: 16, leadTimeDays: 5, minimumOrderQuantity: 2 }),
});
if (changedProduct.product.capacityPerWeek !== 16 || changedProduct.product.leadTimeDays !== 5 || changedProduct.product.minimumOrderQuantity !== 2) {
  throw new Error('Los datos de producción no se conservan correctamente.');
}
console.log('ficha comercial y producción OK');
await expectStatus('WhatsApp sin firma bloqueado', 401, () => api('/api/webhooks/whatsapp', {
  method: 'POST', body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] }),
}));
const crypto = await import('node:crypto');
const waBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const signature = `sha256=${crypto.createHmac('sha256', 'test-app-secret').update(waBody).digest('hex')}`;
const waOk = await fetch(`${base}/api/webhooks/whatsapp`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature }, body: waBody,
});
if (waOk.status !== 200) throw new Error('El webhook válido de WhatsApp se rechazó.');
console.log('WhatsApp con firma válida OK');

/* 3. Semántica de supresiones. */
const byEmail = await api('/api/suppressions', { method: 'POST', body: JSON.stringify({ email: 'uno@dominio.test', company: 'Uno' }) });
console.log('suppression email domain:', JSON.stringify(byEmail.suppression.domain), '| blocked domain?', Boolean(byEmail.suppression.domain));
if (byEmail.suppression.domain) process.exitCode = 1;
const byDomain = await api('/api/suppressions', { method: 'POST', body: JSON.stringify({ email: 'dos@dominio2.test', blockDomain: true }) });
console.log('suppression explicit domain:', byDomain.suppression.domain);
if (byDomain.suppression.domain !== 'dominio2.test') process.exitCode = 1;
await expectStatus('dominio compartido rechazado', 400, () => api('/api/suppressions', { method: 'POST', body: JSON.stringify({ domain: 'gmail.com' }) }));
const byCompany = await api('/api/suppressions', { method: 'POST', body: JSON.stringify({ company: 'Casa Sup' }) });
console.log('suppression company:', byCompany.suppression.company);

/* 4. Opt-out: una respuesta que cita nuestro pie NO debe dar de baja. */
state = await api('/api/state');
const emailThreads = state.threads.filter((t) => t.contact?.email && t.draftCount > 0);
const falseThread = emailThreads[0];
await api(`/api/threads/${falseThread.id}/messages`, {
  method: 'POST',
  body: JSON.stringify({
    direction: 'in',
    subject: 'Consulta',
    body: 'Hola, me interesa la lámpara.\n\n> Si preferís no recibir más mensajes, respondé BAJA y no vuelvo a escribirte.',
    analyze: false,
  }),
});
const falseDetail = (await api(`/api/threads/${falseThread.id}`)).thread;
console.log('falsa baja -> etapa:', falseDetail.stage, '| suprimido:', falseDetail.suppressed);
if (falseDetail.stage === 'perdido' || falseDetail.suppressed) process.exitCode = 1;

/* 5. Opt-out real, bloqueo y reversión. */
state = await api('/api/state');
const trueThread = state.threads.find((t) => t.contact?.email && t.draftCount > 0 && t.id !== falseThread.id);
const trueDetailBefore = (await api(`/api/threads/${trueThread.id}`)).thread;
const trueDraft = trueDetailBefore.drafts.find((d) => d.status === 'listo');
await api(`/api/threads/${trueThread.id}/messages`, {
  method: 'POST',
  body: JSON.stringify({ direction: 'in', subject: 'Re', body: 'BAJA', analyze: false }),
});
const trueDetail = (await api(`/api/threads/${trueThread.id}`)).thread;
console.log('baja real -> etapa:', trueDetail.stage, '| suprimido:', trueDetail.suppressed, '| draft:', trueDetail.drafts.find((d) => d.id === trueDraft.id)?.status);
if (trueDetail.stage !== 'perdido' || !trueDetail.suppressed) process.exitCode = 1;
await expectStatus('envío a contacto suprimido', 400, () => api(`/api/threads/${trueThread.id}/send`, {
  method: 'POST',
  body: JSON.stringify({ draftId: trueDraft.id, channel: 'manual', confirm: true }),
}));
state = await api('/api/state');
const suppressionItem = state.suppressions.find((item) => item.email === trueThread.contact.email);
if (!suppressionItem) {
  console.log('FAILED: no se creó la supresión del opt-out');
  process.exitCode = 1;
} else {
  const released = await api(`/api/suppressions/${suppressionItem.id}`, { method: 'DELETE' });
  console.log('supresión retirada:', released.released);
  const afterUndo = (await api(`/api/threads/${trueThread.id}`)).thread;
  console.log('tras deshacer -> etapa:', afterUndo.stage, '| suprimido:', afterUndo.suppressed);
  if (afterUndo.suppressed) process.exitCode = 1;
  const sent = await api(`/api/threads/${trueThread.id}/send`, {
    method: 'POST',
    body: JSON.stringify({ draftId: trueDraft.id, channel: 'manual', confirm: true }),
  });
  console.log('reenvío manual tras deshacer:', sent.message.status);
}

/* 6. Contacto sin email: se puede marcar como enviado por formulario/LinkedIn. */
state = await api('/api/state');
const noEmailThread = state.threads.find((t) => !t.contact?.email && t.draftCount > 0);
if (noEmailThread) {
  const noEmailDetail = (await api(`/api/threads/${noEmailThread.id}`)).thread;
  const noEmailDraft = noEmailDetail.drafts.find((d) => d.status === 'listo');
  const manual = await api(`/api/threads/${noEmailThread.id}/send`, {
    method: 'POST',
    body: JSON.stringify({ draftId: noEmailDraft.id, channel: 'manual', confirm: true }),
  });
  console.log('manual sin email:', manual.message.status, '| canal:', manual.message.channel, '| etapa:', manual.thread.stage);
  if (manual.message.status !== 'enviado_manual') process.exitCode = 1;
}

/* 7. Aprobación: un borrador en revisión no se envía hasta aprobarlo. */
state = await api('/api/state');
const reviewThread = state.threads.find((t) => t.contact?.email && t.draftCount > 0 && !t.suppressed);
if (reviewThread) {
  const detail = (await api(`/api/threads/${reviewThread.id}`)).thread;
  const draft = detail.drafts.find((d) => d.status === 'listo');
  await api(`/api/threads/${reviewThread.id}/drafts/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'revisar' }) });
  await expectStatus('envío sin aprobar', 400, () => api(`/api/threads/${reviewThread.id}/send`, {
    method: 'POST',
    body: JSON.stringify({ draftId: draft.id, channel: 'manual', confirm: true }),
  }));
  await api(`/api/threads/${reviewThread.id}/drafts/${draft.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'listo' }) });
  const approved = await api(`/api/threads/${reviewThread.id}/send`, {
    method: 'POST',
    body: JSON.stringify({ draftId: draft.id, channel: 'manual', confirm: true }),
  });
  console.log('envío aprobado:', approved.message.status);
}

/* 8. Reconciliación de borradores. */
const reconciled = await api(`/api/missions/${mission.id}/reconcile`, { method: 'POST' });
console.log('reconcile', reconciled.created, reconciled.updated, reconciled.stats?.draftsReady, reconciled.stats?.draftsToReview);

/* 9. Ajustes enmascarados, .eml, respaldo, consulta e inbound. */
await api('/api/settings', { method: 'PUT', body: JSON.stringify({ email: { from: 'Lumbre <hola@lumbre.test>' }, ai: { apiKey: 'sk-test-123456789' } }) });
state = await api('/api/state');
console.log('masked key', state.settings.ai.apiKey, 'from', state.settings.email.from);
await api('/api/settings', { method: 'PUT', body: JSON.stringify({ ai: { apiKey: '' } }) });
state = await api('/api/state');
console.log('key preserved after empty', state.settings.ai.apiKey);

const emlThread = state.threads.find((t) => t.contact?.email && t.draftCount > 0);
const emlDetail = (await api(`/api/threads/${emlThread.id}`)).thread;
const emlDraft = emlDetail.drafts.find((d) => d.status === 'listo');
const eml = await fetch(`${base}/api/threads/${emlThread.id}/eml?draftId=${emlDraft.id}`);
const emlText = await eml.text();
console.log('eml', eml.status, eml.headers.get('content-type'), emlText.slice(0, 40), emlText.includes('To:'));
if (eml.status !== 200) process.exitCode = 1;

await api('/api/settings/secret/clear', { method: 'POST', body: JSON.stringify({ path: 'ai.apiKey' }) });
const ask = await api('/api/ask', { method: 'POST', body: JSON.stringify({ question: '¿Qué hago esta semana?', agentId: 'director' }) });
console.log('ask demo', ask.demo, ask.answer.slice(0, 80));
const backup = await fetch(`${base}/api/backup`);
const buf = Buffer.from(await backup.arrayBuffer());
console.log('backup', backup.status, buf.length, buf.slice(0, 2).toString());
const inbound = await api('/api/webhooks/email', { method: 'POST', body: JSON.stringify({ from: 'Marta <marta@luzdeautor.test>', to: 'hola@lumbre.test', subject: 'Consulta', text: 'Hola, me interesa la lámpara. ¿Cuánto sale el envío a Madrid?' }) });
console.log('inbound', inbound);
const afterInbound = await api('/api/state');
const newThread = afterInbound.threads.find((t) => t.contact?.email === 'marta@luzdeautor.test');
console.log('new inbound thread', newThread?.contact?.company, newThread?.stage, newThread?.messageCount);
console.log('intel countries', (await api('/api/intel')).countries.length);
await api('/api/demo', { method: 'DELETE' });
state = await api('/api/state');
console.log('after clear demo', state.counts, 'products', state.products.length, 'threads', state.threads.length);
console.log('OK');
