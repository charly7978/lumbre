import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {
  Store,
} from '../lib/store.mjs';
import {
  createThreads, migrateLegacyDrafts, missionStatusForSteps, missionWarnings, reconcileThreads,
  selectRelevantLearnings,
} from '../lib/agents.mjs';
import {
  assertCanSend, detectOptOut, isOptOutText, isSuppressed, sentToday, stripQuotedText,
} from '../lib/email.mjs';

let passed = 0;
const dirs = [];
function ok(condition, label, detail = '') {
  if (!condition) {
    console.error(`FALLO: ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  passed += 1;
  console.log(`OK ${label}`);
}

async function freshStore() {
  const dir = path.join(os.tmpdir(), `lumbre-guards-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  dirs.push(dir);
  const store = new Store(dir);
  await store.init();
  return store;
}

const settings = {
  brand: { name: 'Lumbre', maker: 'Ana', website: 'https://lumbre.test', email: 'hola@lumbre.test' },
  email: { provider: 'manual', from: 'Lumbre <hola@lumbre.test>' },
};
const product = { id: 'prod_test', name: 'Aurora 01' };

function buyer(nombre, email, extra = {}) {
  return {
    nombre, contacto: 'Equipo de compras', rol: 'compras', pais: 'España', ciudad: 'Madrid',
    tipo: 'tienda', prioridad: 'alta', email, email_estado: email ? 'publico' : 'desconocido',
    web: 'https://example.org', por_que: 'Prueba', ...extra,
  };
}

function missionFor({ id = `mis_${Math.random().toString(16).slice(2)}`, depth = 'estandar', artifacts = {}, steps } = {}) {
  return {
    id,
    demo: false,
    name: 'Misión de prueba',
    depth,
    maxProspects: 12,
    productId: product.id,
    artifacts,
    steps: steps || [
      { id: 'compliance', title: 'Cumplimiento', status: 'done' },
      { id: 'redteam', title: 'Red team', status: 'done' },
    ],
  };
}

const baseArtifacts = (messages) => ({
  prospecting: { compradores: messages.map((message) => buyer(message.comprador, message.email || `${message.comprador.toLowerCase().replace(/\s+/g, '-')}@tienda.test`)) },
  outreach: { mensajes: messages.map(({ email, ...message }) => message) },
  synthesis: { mensajes_listos: [] },
  compliance: { veredicto: 'aprobado', correcciones: [] },
  redteam: { veredicto: 'avanzar' },
});

/* 1. Mensaje 1:1: el comprador sin mensaje no hereda el de otra tienda. */
{
  const store = await freshStore();
  const buyers = [
    buyer('Luz de Autor', 'compras@luzdeautor.test'),
    buyer('Hotel Alba', 'reservas@hotelalba.test'),
  ];
  const mission = missionFor({
    artifacts: {
      prospecting: { compradores: buyers },
      outreach: {
        mensajes: [{
          comprador: 'Luz de Autor',
          asunto: 'Aurora 01 para Luz de Autor',
          cuerpo: 'Hola Luz de Autor: vi su selección y quería mostrarles Aurora 01. ¿Les mando la ficha? Si preferís no recibir más mensajes, respondé BAJA.',
        }],
      },
      synthesis: { mensajes_listos: [] },
      compliance: { veredicto: 'aprobado', correcciones: [] },
      redteam: { veredicto: 'avanzar' },
    },
  });
  const result = await createThreads(mission, product, settings, store);
  const threads = store.get('threads');
  const luz = threads.find((t) => t.contact.company === 'Luz de Autor');
  const hotel = threads.find((t) => t.contact.company === 'Hotel Alba');
  ok(result.created === 2, 'crea un hilo por comprador');
  ok(luz.drafts.length === 1 && luz.drafts[0].status === 'listo', 'Luz de Autor recibe su borrador listo');
  ok(hotel.drafts.length === 0, 'Hotel Alba no hereda el mensaje de otra tienda');
  ok(/mano/i.test(hotel.nextStep), 'el hilo sin mensaje pide escribirlo a mano', hotel.nextStep);
  const bodies = threads.flatMap((t) => t.drafts.map((d) => d.body));
  ok(new Set(bodies).size === bodies.length, 'no hay cuerpos duplicados');
  ok(mission.stats.draftsReady === 1, 'las estadísticas cuentan solo borradores realmente listos');
  ok(!hotel.nextFollowUp, 'un hilo sin enviar no tiene seguimiento agendado');
  ok(luz.drafts[0].guardVersion === 2, 'el borrador nuevo nace con la guarda v2');
}

/* 2. La revisión post red team se fusiona y no se pisa con campos vacíos. */
{
  const store = await freshStore();
  const mission = missionFor({
    depth: 'profunda',
    steps: [
      { id: 'compliance', title: 'Cumplimiento', status: 'done' },
      { id: 'redteam', title: 'Red team', status: 'done' },
      { id: 'revision', title: 'Revisión', status: 'done' },
    ],
    artifacts: {
      prospecting: { compradores: [buyer('Luz de Autor', 'compras@luzdeautor.test'), buyer('Forma Living', 'info@formaliving.test')] },
      outreach: {
        mensajes: [
          { comprador: 'Luz de Autor', asunto: 'Versión vieja', cuerpo: 'VERSIÓN VIEJA para Luz de Autor. Respondé BAJA si no te interesa.' },
          { comprador: 'Forma Living', asunto: 'Aurora para Forma Living', cuerpo: 'Hola Forma Living: les acerco Aurora 01. Respondé BAJA si no te interesa.' },
        ],
      },
      revision: {
        mensajes: [{ comprador: 'Luz de Autor', asunto: 'Versión corregida', cuerpo: 'VERSIÓN CORREGIDA para Luz de Autor. Respondé BAJA si no te interesa.' }],
      },
      synthesis: { mensajes_listos: [] },
      compliance: { veredicto: 'aprobado', correcciones: [] },
      redteam: { veredicto: 'ajustar' },
    },
  });
  await createThreads(mission, product, settings, store);
  const luz = store.get('threads').find((t) => t.contact.company === 'Luz de Autor');
  const forma = store.get('threads').find((t) => t.contact.company === 'Forma Living');
  ok(luz.drafts[0].body.includes('VERSIÓN CORREGIDA'), 'el borrador usa la revisión');
  ok(luz.drafts[0].revisionApplied === true, 'marca revisión aplicada solo al mensaje revisado');
  ok(!forma.drafts[0].revisionApplied, 'no marca revisión aplicada al mensaje que no fue revisado');
  ok(forma.drafts[0].body.includes('Forma Living'), 'el comprador sin revisión conserva su mensaje 1:1');

  const store2 = await freshStore();
  const emptyRevision = missionFor({
    depth: 'profunda',
    steps: [{ id: 'compliance' }, { id: 'redteam' }, { id: 'revision' }],
    artifacts: {
      ...baseArtifacts([{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: 'Hola Luz de Autor, mensaje bueno. BAJA si no.' }]),
      compliance: { veredicto: 'aprobado', correcciones: [] },
      redteam: { veredicto: 'ajustar' },
      revision: { mensajes: [{ comprador: 'Luz de Autor', asunto: '', cuerpo: '' }] },
    },
  });
  await createThreads(emptyRevision, product, settings, store2);
  const draft = store2.get('threads')[0].drafts[0];
  ok(draft && draft.body.includes('mensaje bueno'), 'una revisión con campos vacíos no borra el mensaje');
}

/* 3. Veredictos y revisiones. */
{
  const store = await freshStore();
  const mission = missionFor({
    artifacts: {
      ...baseArtifacts([{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: 'Hola Luz de Autor, ¿les interesa? BAJA.' }]),
      compliance: { veredicto: 'rechazado', correcciones: [] },
      redteam: { veredicto: 'avanzar' },
    },
  });
  await createThreads(mission, product, settings, store);
  const draft = store.get('threads')[0].drafts[0];
  ok(draft.status === 'bloqueado', 'cumplimiento rechazado bloquea el borrador');
  ok(mission.notices.some((n) => n.type === 'compliance'), 'la misión avisa el bloqueo');
}

/* 3b. Sin revisión obligatoria, los borradores quedan para aprobar. */
{
  const store = await freshStore();
  const mission = missionFor({
    artifacts: {
      prospecting: { compradores: [buyer('Luz de Autor', 'compras@luzdeautor.test')] },
      outreach: { mensajes: [{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: 'Hola Luz de Autor. BAJA.' }] },
      synthesis: { mensajes_listos: [] },
    },
  });
  await createThreads(mission, product, settings, store);
  const draft = store.get('threads')[0].drafts[0];
  ok(draft.status === 'revisar', 'sin revisión, el borrador queda en revisar');
  ok(/revisión/i.test(draft.reviewNote || ''), 'el borrador explica que falta la revisión');
}

/* 3c. Correcciones de cumplimiento: se aplican solo si coinciden. */
{
  const store = await freshStore();
  const withCorrection = await freshStore();
  const message = 'Hola Luz de Autor, luz cálida regulable y serie corta. BAJA.';
  const mission = missionFor({
    artifacts: {
      ...baseArtifacts([{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: message }]),
      compliance: {
        veredicto: 'con_cambios',
        correcciones: [{ campo: 'mensaje', original: 'luz cálida regulable', sugerido: 'luz cálida regulable (220–240 V)' }],
      },
    },
  });
  await createThreads(mission, product, settings, withCorrection);
  const applied = withCorrection.get('threads')[0].drafts[0];
  ok(applied.status === 'listo', 'una corrección aplicada no bloquea el borrador');
  ok(applied.body.includes('220–240 V'), 'la corrección de cumplimiento se aplica al cuerpo');
  ok(applied.complianceCorrections === 1, 'cuenta la corrección aplicada');

  const unresolvedMission = missionFor({
    artifacts: {
      ...baseArtifacts([{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: message }]),
      compliance: {
        veredicto: 'con_cambios',
        correcciones: [{ campo: 'mensaje', original: 'frase que no existe en el correo', sugerido: 'otra cosa' }],
      },
    },
  });
  await createThreads(unresolvedMission, product, settings, store);
  const unresolved = store.get('threads')[0].drafts[0];
  ok(unresolved.status === 'revisar', 'una corrección que no coincide deja el borrador en revisión');
  ok(/no coinciden/i.test(unresolved.reviewNote || ''), 'explica que la corrección no coincide');

  const contentStore = await freshStore();
  const contentMission = missionFor({
    artifacts: {
      ...baseArtifacts([{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: message }]),
      content: { calendario: [{ caption: 'Materiales sustentables.' }] },
      compliance: {
        veredicto: 'con_cambios',
        correcciones: [{ campo: 'mensaje', original: 'Materiales sustentables.', sugerido: 'Filamento PLA.' }],
      },
    },
  });
  await createThreads(contentMission, product, settings, contentStore);
  ok(contentStore.get('threads')[0].drafts[0].status === 'listo', 'una corrección citada del contenido no bloquea el correo');
}

/* 4. Dedupe por email y por empresa entre misiones. */
{
  const store = await freshStore();
  store.get('threads').push(
    { id: 'thr_old_1', missionId: 'mis_old_1', contact: { company: 'Luz de Autor', email: 'compras@luzdeautor.test' }, drafts: [], messages: [] },
    { id: 'thr_old_2', missionId: 'mis_old_2', contact: { company: 'Casa Nórdica', email: 'contacto@casanordica-old.test' }, drafts: [], messages: [] },
  );
  await store.set('threads', store.get('threads'));
  const mission = missionFor({
    artifacts: baseArtifacts([
      { comprador: 'Luz de Autor', email: 'compras@luzdeautor.test', asunto: 'Hola', cuerpo: 'Hola Luz de Autor. BAJA.' },
      { comprador: 'Casa Nórdica', email: 'nuevo@casanordica.test', asunto: 'Hola', cuerpo: 'Hola Casa Nórdica. BAJA.' },
    ]),
  });
  const result = await createThreads(mission, product, settings, store);
  ok(result.created === 0, 'no crea hilos de contactos ya contactados');
  ok(mission.skippedProspects.length === 2, 'registra los dos compradores salteados');
  ok(mission.skippedProspects.some((s) => s.reason.includes('email')), 'detecta el email repetido');
  ok(mission.skippedProspects.some((s) => s.reason.includes('empresa')), 'detecta la empresa repetida');
}

/* 4b. Los datos demo no bloquean una misión real. */
{
  const store = await freshStore();
  store.get('threads').push({
    id: 'thr_demo', demo: true, missionId: 'mis_demo', contact: { company: 'Luz de Autor', email: 'compras@luzdeautor.test' }, drafts: [], messages: [],
  });
  store.get('suppressions').push({ id: 'sup_demo', demo: true, email: 'compras@luzdeautor.test', domain: '', company: '', reason: 'demo' });
  await store.set('threads', store.get('threads'));
  await store.set('suppressions', store.get('suppressions'));
  const mission = missionFor({
    artifacts: baseArtifacts([{ comprador: 'Luz de Autor', email: 'compras@luzdeautor.test', asunto: 'Hola', cuerpo: 'Hola Luz de Autor. BAJA.' }]),
  });
  const result = await createThreads(mission, product, settings, store);
  ok(result.created === 1, 'un hilo/supresión demo no bloquea la misión real');
}

/* 5. Supresiones: email, dominio explícito, empresa y dominios compartidos. */
{
  ok(!isSuppressed('otro@empresa.test', [{ email: 'uno@empresa.test', domain: '' }]), 'un email no bloquea todo el dominio');
  ok(isSuppressed('otro@empresa.test', [{ email: '', domain: 'empresa.test' }]), 'un dominio explícito sí bloquea el dominio');
  ok(!isSuppressed('alguien@gmail.com', [{ email: '', domain: 'gmail.com' }]), 'un dominio compartido no bloquea a todos');
  ok(isSuppressed('', [{ email: '', domain: '', company: 'Casa Sup' }], 'Casa Sup'), 'una empresa suprimida se detecta por nombre');
  ok(isSuppressed('hola@casasup.test', [{ email: 'hola@casasup.test' }]), 'un email suprimido se detecta');

  let manualAllowed = false;
  try {
    assertCanSend(settings, [], '', [], { manual: true });
    manualAllowed = true;
  } catch { /* noop */ }
  ok(manualAllowed, 'el envío manual sin email está permitido (formulario/LinkedIn)');
  let realRejected = false;
  try {
    assertCanSend(settings, [], '', [], { manual: false });
  } catch {
    realRejected = true;
  }
  ok(realRejected, 'un envío real sin email se rechaza');
  let companyBlocked = false;
  try {
    assertCanSend(settings, [], 'hola@casasup.test', [{ email: '', domain: '', company: 'Casa Sup' }], { manual: true, company: 'Casa Sup' });
  } catch {
    companyBlocked = true;
  }
  ok(companyBlocked, 'una empresa suprimida bloquea el envío manual');
}

/* 6. Opt-out: intención real, sin falsos positivos por citas ni palabras. */
{
  const positives = [
    'BAJA',
    'Re: consulta\nBAJA',
    'Por favor, denme de baja del listado.',
    'No me escriban más, gracias.',
    'Quiero darme de baja de su lista.',
    'unsubscribe',
    'Please remove me from this list.',
    'Please do not email me again.',
    'Que me den de baja, por favor.',
    'Dejen de enviar correos.',
  ];
  for (const text of positives) ok(isOptOutText(text), `detecta baja: ${text.slice(0, 32)}`);

  const negatives = [
    'Estamos en Baja California, ¿hacen envíos?',
    'En temporada baja no compramos.',
    'La demanda bajó este año.',
    'Hola, me interesa la lámpara. ¿Cuánto sale el envío?',
    'Hola, me interesa.\n\n> Si preferís no recibir más mensajes, respondé BAJA y no vuelvo a escribirte.',
    'Hola, me interesa.\n\nEl 15/11 Lumbre escribió:\n> Si preferís no recibir más mensajes, respondé BAJA.',
    'Hola, me interesa.\n\n-----Original Message-----\nSi preferís no recibir más mensajes, respondé BAJA.',
    'Hola, me interesa.<br><br><blockquote>Si preferís no recibir más mensajes, respondé BAJA.</blockquote>',
    'Please stop by the store tomorrow so we can talk.',
  ];
  for (const text of negatives) ok(!isOptOutText(text), `no confunde: ${text.split('\n')[0].slice(0, 32)}`);

  const signal = detectOptOut('No me contacten más');
  ok(signal && signal.rule && signal.phrase, 'detectOptOut devuelve regla y frase');
  ok(!stripQuotedText('Hola\n> BAJA').includes('BAJA'), 'stripQuotedText quita las citas');
}

/* 7. Contadores manuales y estados de misión. */
{
  const today = new Date().toISOString();
  const count = sentToday([
    { messages: [{ direction: 'out', status: 'enviado', provider: 'manual', at: today }] },
    { messages: [{ direction: 'out', status: 'enviado_manual', at: today }] },
    { messages: [{ direction: 'out', status: 'enviado', provider: 'resend', at: today }] },
  ]);
  ok(count === 1, 'los envíos manuales no consumen el cupo', String(count));

  const failed = [
    { id: 'prospecting', title: 'Compradores', status: 'error', error: 'Sin resultados', critical: false },
    { id: 'synthesis', title: 'Plan final', status: 'done', critical: true },
  ];
  ok(missionWarnings(failed).length === 1, 'missionWarnings lista el paso fallido');
  ok(missionStatusForSteps(failed) === 'done_with_warnings', 'una misión con pasos fallidos no se declara perfecta');
  ok(missionStatusForSteps([{ id: 'synthesis', status: 'done' }]) === 'done', 'sin fallos, la misión queda done');
}

/* 8. Memoria: los aprendizajes demo no contaminan misiones reales. */
{
  const learnings = [
    { id: 'l1', demo: true, confidence: 'alta', pinned: false },
    { id: 'l2', demo: true, confidence: 'alta', pinned: true },
    { id: 'l3', demo: false, confidence: 'alta', pinned: false },
    { id: 'l4', demo: false, confidence: 'media', pinned: false },
    { id: 'l5', demo: false, confidence: 'media', pinned: true },
  ];
  const real = selectRelevantLearnings(learnings, { demo: false }).map((item) => item.id);
  ok(!real.includes('l1') && !real.includes('l2'), 'una misión real no recibe aprendizajes demo');
  ok(real.includes('l3') && real.includes('l5'), 'una misión real recibe alta confianza y fijados reales');
  const demo = selectRelevantLearnings(learnings, { demo: true }).map((item) => item.id);
  ok(demo.includes('l1') && demo.includes('l2'), 'una misión demo sí puede usar aprendizajes demo');
}

/* 9. Migración de borradores viejos: revisión faltante y cuerpos duplicados. */
{
  const store = await freshStore();
  const missionMissing = {
    id: 'mis_missing', demo: false, name: 'Vieja', depth: 'estandar', productId: product.id,
    artifacts: {}, steps: [{ id: 'compliance' }, { id: 'redteam' }],
  };
  const missionOk = {
    id: 'mis_ok', demo: false, name: 'Completa', depth: 'estandar', productId: product.id,
    artifacts: { compliance: { veredicto: 'aprobado' }, redteam: { veredicto: 'avanzar' } },
    steps: [{ id: 'compliance' }, { id: 'redteam' }],
  };
  store.get('missions').push(missionMissing, missionOk);
  store.get('threads').push(
    { id: 'thr_missing', missionId: 'mis_missing', contact: { company: 'A', email: 'a@a.test' }, drafts: [{ id: 'd1', status: 'listo', body: 'Cuerpo A. BAJA.' }], messages: [] },
    { id: 'thr_ok_1', missionId: 'mis_ok', contact: { company: 'B', email: 'b@b.test' }, drafts: [{ id: 'd2', status: 'listo', body: 'Mismo cuerpo. BAJA.' }], messages: [] },
    { id: 'thr_ok_2', missionId: 'mis_ok', contact: { company: 'C', email: 'c@c.test' }, drafts: [{ id: 'd3', status: 'listo', body: 'Mismo cuerpo. BAJA.' }], messages: [] },
  );
  await store.set('missions', store.get('missions'));
  await store.set('threads', store.get('threads'));
  const first = await migrateLegacyDrafts(store);
  const threads = store.get('threads');
  const missing = threads.find((t) => t.id === 'thr_missing');
  const ok1 = threads.find((t) => t.id === 'thr_ok_1');
  const ok2 = threads.find((t) => t.id === 'thr_ok_2');
  ok(first.changed === 3, 'migra los tres borradores viejos', String(first.changed));
  ok(missing.drafts[0].status === 'revisar', 'sin revisión de la misión, el borrador viejo pasa a revisar');
  ok(ok1.drafts[0].status === 'listo', 'el primer cuerpo duplicado queda listo');
  ok(ok2.drafts[0].status === 'revisar', 'el segundo cuerpo duplicado pasa a revisar');
  const second = await migrateLegacyDrafts(store);
  ok(second.changed === 0, 'la migración es idempotente');
}

/* 9b. Migración: contacto repetido entre misiones distintas. */
{
  const store = await freshStore();
  const mkMission = (id) => ({
    id, demo: false, name: id, depth: 'estandar', productId: product.id,
    artifacts: { compliance: { veredicto: 'aprobado' }, redteam: { veredicto: 'avanzar' } },
    steps: [{ id: 'compliance' }, { id: 'redteam' }],
  });
  store.get('missions').push(mkMission('mis_x'), mkMission('mis_y'));
  store.get('threads').push(
    { id: 'thr_x', missionId: 'mis_x', contact: { company: 'Luz de Autor', email: 'uno@luz.test' }, drafts: [{ id: 'dx', status: 'listo', body: 'Cuerpo uno. BAJA.' }], messages: [] },
    { id: 'thr_y', missionId: 'mis_y', contact: { company: 'Luz de Autor', email: 'dos@luz.test' }, drafts: [{ id: 'dy', status: 'listo', body: 'Cuerpo dos. BAJA.' }], messages: [] },
  );
  await store.set('missions', store.get('missions'));
  await store.set('threads', store.get('threads'));
  await migrateLegacyDrafts(store);
  const [firstThread, secondThread] = store.get('threads');
  ok(firstThread.drafts[0].status === 'listo', 'el primer contacto entre misiones queda listo');
  ok(secondThread.drafts[0].status === 'revisar', 'el contacto repetido en otra misión pasa a revisar');
  ok(/otro hilo/i.test(secondThread.drafts[0].reviewNote || ''), 'la nota avisa del hilo repetido');
}


{
  const store = await freshStore();
  const mission = missionFor({
    id: 'mis_reconcile',
    depth: 'profunda',
    steps: [{ id: 'compliance' }, { id: 'redteam' }, { id: 'revision' }],
    artifacts: {
      prospecting: { compradores: [buyer('Luz de Autor', 'compras@luzdeautor.test')] },
      outreach: { mensajes: [{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: 'Hola Luz de Autor, versión vieja. BAJA si no.' }] },
      synthesis: { mensajes_listos: [] },
    },
  });
  await createThreads(mission, product, settings, store);
  let draft = store.get('threads')[0].drafts[0];
  ok(draft.status === 'revisar', 'sin revisión, el borrador nace en revisar');

  mission.artifacts.compliance = { veredicto: 'aprobado', correcciones: [] };
  mission.artifacts.redteam = { veredicto: 'ajustar' };
  mission.artifacts.revision = { mensajes: [{ comprador: 'Luz de Autor', asunto: 'Corregido', cuerpo: 'Hola Luz de Autor, versión corregida. BAJA si no.' }] };
  const retryOnly = await createThreads(mission, product, settings, store);
  draft = store.get('threads')[0].drafts[0];
  ok(retryOnly.updated === 0 && draft.status === 'revisar', 'createThreads no reconcilia por sí solo');
  const reconciled = await reconcileThreads(mission, product, settings, store);
  draft = store.get('threads')[0].drafts[0];
  ok(reconciled.updated === 1, 'reconciliar actualiza el borrador existente');
  ok(draft.status === 'listo' && draft.body.includes('versión corregida'), 'el borrador toma la revisión y queda listo');

  draft.approvedAt = new Date().toISOString();
  draft.approvedBy = 'dueño';
  mission.artifacts.revision = { mensajes: [{ comprador: 'Luz de Autor', asunto: 'Otra', cuerpo: 'Hola Luz de Autor, otra versión. BAJA si no.' }] };
  await reconcileThreads(mission, product, settings, store);
  draft = store.get('threads')[0].drafts[0];
  ok(draft.status === 'revisar', 'si el contenido cambia tras aprobar, vuelve a revisión');
  ok(!draft.approvedAt, 'la aprobación vieja se descarta');
}

/* 10b. Una revisión de migración no se auto-aprueba al revalidar. */
{
  const store = await freshStore();
  const mission = missionFor({
    id: 'mis_locked',
    artifacts: {
      ...baseArtifacts([{ comprador: 'Luz de Autor', asunto: 'Hola', cuerpo: 'Hola Luz de Autor, mensaje listo. BAJA.' }]),
      compliance: { veredicto: 'aprobado', correcciones: [] },
      redteam: { veredicto: 'avanzar' },
    },
  });
  store.get('missions').push(mission);
  store.get('threads').push({
    id: 'thr_locked', missionId: mission.id, contact: { company: 'Luz de Autor', email: 'compras@luzdeautor.test' },
    drafts: [{
      id: 'drf_locked', source: 'mision', status: 'revisar', lockedReview: true,
      subject: 'Hola', body: 'Hola Luz de Autor, mensaje listo. BAJA.',
      reviewNote: 'Migración: contacto repetido.', createdAt: new Date().toISOString(),
    }],
    messages: [],
  });
  await store.set('missions', store.get('missions'));
  await store.set('threads', store.get('threads'));
  await reconcileThreads(mission, product, settings, store);
  const draft = store.get('threads')[0].drafts[0];
  ok(draft.status === 'revisar', 'revalidar no levanta una revisión de migración');
  ok(/Migración/i.test(draft.reviewNote || ''), 'conserva la nota de migración');
}

for (const dir of dirs) {
  await fs.rm(dir, { recursive: true, force: true });
}

console.log(`\n${passed} comprobaciones OK`);
