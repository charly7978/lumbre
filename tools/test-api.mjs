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

/* 10. Importación de catálogo por CSV. */
const csv = [
  'nombre,codigo,precio,costo,moneda,estado,materiales,capacidad,plazo,pago',
  'Lámpara CSV Uno,CSV-1,120,40,USD,listo,PLA,12,10,https://pagos.test/csv-1',
  'Lámpara CSV Dos,CSV-2,"95,50",30,USD,borrador,PLA,4,7,https://pagos.test/csv-2',
  'Lámpara CSV Dos,CSV-3,100,30,USD,borrador,PLA,4,7,',
].join('\n');
const imported = await fetch(`${base}/api/products/import`, {
  method: 'POST',
  headers: { 'content-type': 'text/csv' },
  body: csv,
}).then(async (response) => ({ status: response.status, data: await response.json() }));
console.log('csv import', imported.status, imported.data.created, imported.data.skipped?.length);
if (imported.data.created !== 2 || imported.data.skipped?.length !== 1) process.exitCode = 1;
const csvTarget = imported.data.products.find((product) => /CSV Dos/.test(product.name));
if (!csvTarget) {
  console.log('csv target missing');
  process.exitCode = 1;
}
const csvProduct = (await api(`/api/products/${csvTarget.id}`)).product;
console.log('csv price', csvProduct.price, '| status', csvProduct.status, '| code', csvTarget.code, '| cap', csvProduct.capacityPerWeek, '| lead', csvProduct.leadTimeDays, '| pay', csvProduct.paymentLink);
if (csvProduct.price !== 95.5) process.exitCode = 1;
if (csvProduct.status !== 'borrador') process.exitCode = 1;
if (csvProduct.capacityPerWeek !== 4 || csvProduct.leadTimeDays !== 7) process.exitCode = 1;
if (csvProduct.paymentLink !== 'https://pagos.test/csv-2') process.exitCode = 1;

/* 11. Campaña de catálogo: una misión por producto, mercados rotados. */
const campaign = await api('/api/campaigns', {
  method: 'POST',
  body: JSON.stringify({
    productIds: imported.data.products.map((product) => product.id),
    markets: ['España', 'México'],
    marketStrategy: 'rotate',
    depth: 'rapida',
    mode: 'demo',
    name: 'Prueba de catálogo',
  }),
});
const campaignMissions = campaign.campaign?.created || [];
console.log('campaign', campaign.campaign?.campaignId, campaignMissions.length, campaignMissions.map((m) => m.markets.join('/')));
if (campaignMissions.length !== 2 || campaignMissions[0].markets[0] === campaignMissions[1].markets[0]) process.exitCode = 1;
const campaignState = await api('/api/state');
const queuedCampaign = campaignState.missions.filter((m) => m.campaignId === campaign.campaign.campaignId);
console.log('campaign queued', queuedCampaign.length, queuedCampaign.map((m) => m.status).join(','));
if (queuedCampaign.length !== 2) process.exitCode = 1;

/* 12. Cotizaciones: crear, enviar, aceptar y reiniciar la postventa. */
state = await api('/api/state');
const quoteThread = state.threads.find((t) => t.contact?.email === 'marta@luzdeautor.test');
if (!quoteThread) {
  console.log('FAILED: falta el hilo entrante para cotizar');
  process.exitCode = 1;
} else {
  const quoteCreated = await api(`/api/threads/${quoteThread.id}/quotes`, {
    method: 'POST',
    body: JSON.stringify({
      productId: product.id, quantity: 2, unitPrice: 250, shipping: 30, discount: 10, taxRate: 21,
      notes: 'Entrega en Madrid', approve: false,
    }),
  });
  console.log('quote', quoteCreated.quote.number, quoteCreated.quote.status, quoteCreated.quote.total, quoteCreated.draft.status);
  if (quoteCreated.quote.status !== 'borrador') process.exitCode = 1;
  if (quoteCreated.quote.total !== 629.2) process.exitCode = 1;
  if (quoteCreated.draft.status !== 'revisar' || !quoteCreated.draft.quoteId) process.exitCode = 1;
  if (!quoteCreated.draft.subject.includes(quoteCreated.quote.number)) process.exitCode = 1;
  if (!quoteCreated.draft.body.includes(product.name) || !/629[.,]20/.test(quoteCreated.draft.body)) process.exitCode = 1;

  await expectStatus('cotización sin precio', 400, () => api(`/api/threads/${quoteThread.id}/quotes`, {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, unitPrice: 0 }),
  }));

  await api(`/api/threads/${quoteThread.id}/drafts/${quoteCreated.draft.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'listo' }),
  });
  const quoteSend = await api(`/api/threads/${quoteThread.id}/send`, {
    method: 'POST',
    body: JSON.stringify({ draftId: quoteCreated.draft.id, channel: 'manual', confirm: true }),
  });
  const sentQuote = (await api(`/api/threads/${quoteThread.id}`)).thread.quotes.find((item) => item.id === quoteCreated.quote.id);
  console.log('quote sent', sentQuote?.status, '| messageId', Boolean(quoteSend.message.messageId));
  if (sentQuote?.status !== 'enviada') process.exitCode = 1;
  if (!quoteSend.message.messageId) process.exitCode = 1;

  const accepted = await api(`/api/threads/${quoteThread.id}/quotes/${quoteCreated.quote.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'aceptada' }),
  });
  console.log('quote accepted', accepted.quote.status, '| stage', accepted.thread.stage, '| postSaleAt', Boolean(accepted.thread.postSaleAt));
  if (accepted.quote.status !== 'aceptada') process.exitCode = 1;
  if (accepted.thread.stage !== 'ganado' || !accepted.thread.postSaleAt) process.exitCode = 1;

  const unsentQuote = await api(`/api/threads/${quoteThread.id}/quotes`, {
    method: 'POST',
    body: JSON.stringify({ productId: product.id, quantity: 1, unitPrice: 200, approve: false }),
  });
  const acceptedUnsent = await api(`/api/threads/${quoteThread.id}/quotes/${unsentQuote.quote.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'aceptada' }),
  });
  const unsentDraft = acceptedUnsent.thread.drafts.find((draft) => draft.id === unsentQuote.draft.id);
  console.log('accepted unsent quote draft', unsentDraft?.status);
  if (unsentDraft?.status !== 'descartado') process.exitCode = 1;

  await expectStatus('estado de cotización inválido', 400, () => api(`/api/threads/${quoteThread.id}/quotes/${quoteCreated.quote.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'inventado' }),
  }));

  /* 12b. Enrutado de respuestas: In-Reply-To gana sobre el asunto. */
  const routed = await api('/api/webhooks/email', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        from: 'Marta <marta@luzdeautor.test>',
        to: 'hola@lumbre.test',
        subject: 'Un asunto completamente distinto',
        text: 'Perfecto, avancemos con el pedido.',
        headers: {
          'Message-ID': '<routing-test@luzdeautor.test>',
          'In-Reply-To': quoteSend.message.messageId,
          References: quoteSend.message.messageId,
        },
      },
    }),
  });
  console.log('reply routed by Message-ID:', routed.threadId === quoteThread.id);
  if (routed.threadId !== quoteThread.id) process.exitCode = 1;
  const routedDetail = (await api(`/api/threads/${quoteThread.id}`)).thread;
  const routedMessage = routedDetail.messages.find((m) => m.messageId === '<routing-test@luzdeautor.test>');
  console.log('routed message stored', Boolean(routedMessage), '| inReplyTo', routedMessage?.inReplyTo);
  if (!routedMessage || routedMessage.inReplyTo !== quoteSend.message.messageId) process.exitCode = 1;
}

/* 13. Rebote definitivo: suprime, pierde el hilo y bloquea sus borradores. */
{
  const bounce = await api('/api/webhooks/email', {
    method: 'POST',
    body: JSON.stringify({
      type: 'email.bounced',
      data: { to: ['marta@luzdeautor.test'], bounce: { type: 'Permanent', subType: 'General', message: 'mailbox not found' } },
    }),
  });
  console.log('bounce event', bounce.event, '| touched', bounce.touched, '| suppressed', bounce.suppressed);
  if (bounce.event !== 'bounce' || bounce.suppressed !== 1) process.exitCode = 1;
  state = await api('/api/state');
  const bouncedThread = state.threads.find((t) => t.contact?.email === 'marta@luzdeautor.test');
  const bouncedSuppression = state.suppressions.find((item) => item.email === 'marta@luzdeautor.test');
  console.log('bounced thread', bouncedThread?.stage, bouncedThread?.contact?.emailStatus, '| suppression', Boolean(bouncedSuppression));
  if (bouncedThread?.stage !== 'perdido' || bouncedThread?.contact?.emailStatus !== 'rebotado' || !bouncedSuppression) process.exitCode = 1;
}

/* 14. Ficha incompleta: una misión real se frena antes de gastar búsquedas. */
{
  await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ ai: { provider: 'custom', baseUrl: 'http://127.0.0.1:9/v1', model: 'local-test', apiKey: '' } }),
  });
  const draftProduct = await api('/api/products', {
    method: 'POST',
    body: JSON.stringify({ name: 'Producto sin precio', price: 0, status: 'borrador', description: 'Ficha incompleta a propósito.' }),
  });
  let readinessError = null;
  try {
    await api('/api/missions', {
      method: 'POST',
      body: JSON.stringify({ productId: draftProduct.product.id, mode: 'real', markets: ['España'], depth: 'rapida' }),
    });
  } catch (error) { readinessError = error; }
  console.log('misión real con ficha incompleta:', readinessError?.status, readinessError?.message);
  if (readinessError?.status !== 400 || !/no está listo/.test(readinessError.message)) process.exitCode = 1;
  await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ ai: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' } }),
  });
}

await api('/api/demo', { method: 'DELETE' });
state = await api('/api/state');
console.log('after clear demo', state.counts, 'products', state.products.length, 'threads', state.threads.length);
if (!state.funnel || typeof state.funnel.sold !== 'number') process.exitCode = 1;
console.log('OK');
