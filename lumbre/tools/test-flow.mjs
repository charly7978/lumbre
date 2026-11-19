import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Store } from '../lib/store.mjs';
import {
  createThreads, isAggregatorSite, isNotBuyerSite, isPlaceholderBuyerName, normalizeProspectUrl,
  reconcileThreads, releaseInterruptedMissions, sanitizeLegacyThreads, verifyProspectArtifact,
} from '../lib/agents.mjs';
import { candidatesForMarkets, directorySize, SEED_BUYERS } from '../lib/directory.mjs';

let passed = 0;
const dirs = [];
function ok(condition, label, detail = '') {
  if (!condition) {
    console.error(`FALLO: ${label}${detail ? ` â€” ${detail}` : ''}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  passed += 1;
  console.log(`OK ${label}`);
}

async function freshStore() {
  const dir = path.join(os.tmpdir(), `lumbre-flow-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  dirs.push(dir);
  const store = new Store(dir);
  await store.init();
  return store;
}

/* 1. Nombres genÃ©ricos: nunca son compradores. */
const genericNames = [
  'Tienda de diseÃ±o independiente (ejemplo genÃ©rico, sin nombre verificable)',
  'Hotel boutique (ejemplo genÃ©rico, sin nombre verificable)',
  'Estudio de interiorismo',
  'Museo-tienda',
  'Marketplace de comparación',
  'idealo.es (marketplace de comparación)',
];
for (const name of genericNames) ok(isPlaceholderBuyerName(name), `rechaza nombre genÃ©rico: ${name.slice(0, 42)}`);
for (const name of ['Luz de Autor', 'Avanluce', 'Muebles Lluesma', 'Casa Blanco', 'AÃ±os Luz']) {
  ok(!isPlaceholderBuyerName(name), `acepta nombre real: ${name}`);
}

/* 2. NormalizaciÃ³n de URLs y detecciÃ³n de agregadores. */
ok(normalizeProspectUrl('sin dato') === '', 'descarta el texto "sin dato" como URL');
ok(normalizeProspectUrl('https://www.avanluce.com/') === 'https://www.avanluce.com', 'normaliza la URL del sitio');
ok(normalizeProspectUrl('avanluce.com') === 'https://avanluce.com', 'agrega https a un dominio suelto');
ok(isAggregatorSite('https://www.idealo.es'), 'detecta un marketplace de comparaciÃ³n');
ok(!isAggregatorSite('https://www.avanluce.com'), 'un sitio de tienda no es agregador');
ok(isNotBuyerSite('https://www.vibia.com'), 'detecta un fabricante: no es comprador');
ok(!isNotBuyerSite('https://www.ideasluz.com'), 'una tienda multimarca sÃ­ es comprador');

/* 2b. Directorio semilla: real, separado por mercado y sin emails inventados. */
ok(directorySize() >= 12, 'el directorio semilla tiene tiendas reales', String(directorySize()));
ok(candidatesForMarkets(['EspaÃ±a']).length >= 8, 'el directorio cubre EspaÃ±a');
ok(candidatesForMarkets(['EspaÃ±a']).every((buyer) => buyer.pais === 'EspaÃ±a'), 'filtra por paÃ­s');
ok(candidatesForMarkets(['Estados Unidos']).some((buyer) => /Miami/i.test(buyer.ciudad)), 'cubre Estados Unidos con una tienda real');
ok(candidatesForMarkets(['Marte']).length === 0, 'no inventa mercados');
ok(SEED_BUYERS.every((buyer) => !buyer.email), 'el directorio no trae emails a mano: se descubren en el sitio');
ok(SEED_BUYERS.every((buyer) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(buyer.web)), 'todas las entradas tienen sitio web real');
ok(candidatesForMarkets(['EspaÃ±a']).every((buyer) => buyer.origen === 'directorio'), 'marca el origen del directorio');

/* 3. VerificaciÃ³n: lo genÃ©rico, el agregador y lo que no se puede comprobar se descartan. */
const output = {
  compradores: [
    { nombre: 'Tienda de diseño independiente (ejemplo genérico)', web: '', email: '', fuente: '' },
    { nombre: 'Idealo', web: 'https://www.idealo.es', email: '', fuente: 'https://www.idealo.es' },
    { nombre: 'Avanluce', web: '', email: '', fuente: 'https://www.avanluce.com/' },
    { nombre: 'Luz de Autor', web: '', email: '', fuente: 'https://otro-sitio.example/a' },
  ],
  segmentos: [],
};
const verifiedArtifact = await verifyProspectArtifact(output, {
  mission: { maxProspects: 12 },
  search: {
    results: [{ url: 'https://www.avanluce.com/', title: 'Avanluce Â· Tienda de iluminaciÃ³n en Barcelona', snippet: 'LÃ¡mparas de diseÃ±o en Barcelona.' }],
    pages: [],
  },
}, {});
ok(verifiedArtifact.compradores.length === 1, 'solo queda el comprador comprobable', String(verifiedArtifact.compradores.length));
ok(verifiedArtifact.compradores[0].nombre === 'Avanluce', 'conserva el comprador real');
ok(verifiedArtifact.compradores[0].web_estado === 'fuente_secundaria', 'marca de dÃ³nde se verificÃ³');
ok(verifiedArtifact.verificacion.descartados === 3, 'cuenta los descartes');
ok(verifiedArtifact.descartados.some((item) => /gen/i.test(item.motivo)), 'explica el descarte genÃ©rico');
ok(verifiedArtifact.descartados.some((item) => /marketplace/i.test(item.motivo)), 'explica el descarte de marketplace');
ok(verifiedArtifact.descartados.some((item) => /fuente|sitio/i.test(item.motivo)), 'explica el descarte sin fuente');

/* 4. MigraciÃ³n de hilos histÃ³ricos: ni borra ni deja fantasmas activos. */
{
  const store = await freshStore();
  const now = new Date().toISOString();
  store.get('threads').push(
    {
      id: 'thr_generic', demo: false, missionId: 'mis_x', stage: 'nuevo',
      contact: { company: 'Hotel boutique (ejemplo genÃ©rico, sin nombre verificable)', name: '', email: '', website: '' },
      drafts: [{ id: 'd1', status: 'listo', body: 'Hola Hotel boutique.' }], messages: [], createdAt: now,
    },
    {
      id: 'thr_unverified', demo: false, missionId: 'mis_x', stage: 'nuevo',
      contact: { company: 'Muebles Lluesma', name: '', email: '', website: 'sin dato' },
      drafts: [{ id: 'd2', status: 'listo', body: 'Hola Muebles Lluesma.' }], messages: [], createdAt: now,
    },
    {
      id: 'thr_real', demo: false, missionId: 'mis_x', stage: 'nuevo',
      contact: { company: 'Luz de Autor', name: '', email: 'compras@luzdeautor.test', website: '' },
      drafts: [{ id: 'd3', status: 'listo', body: 'Hola Luz de Autor.' }], messages: [], createdAt: now,
    },
    {
      id: 'thr_agg', demo: false, missionId: 'mis_x', stage: 'nuevo',
      contact: { company: 'idealo.es', name: '', email: '', website: 'https://www.idealo.es' },
      drafts: [{ id: 'd5', status: 'listo', body: 'Hola idealo.' }], messages: [], createdAt: now,
    },
    {
      id: 'thr_demo', demo: true, missionId: 'mis_demo', stage: 'nuevo',
      contact: { company: 'Hotel boutique (ejemplo genÃ©rico)', name: '', email: '', website: '' },
      drafts: [{ id: 'd4', status: 'listo', body: 'Hola.' }], messages: [], createdAt: now,
    },
  );
  await store.set('threads', store.get('threads'));
  const first = await sanitizeLegacyThreads(store);
  const threads = store.get('threads');
  const generic = threads.find((t) => t.id === 'thr_generic');
  const unverified = threads.find((t) => t.id === 'thr_unverified');
  const real = threads.find((t) => t.id === 'thr_real');
  const demo = threads.find((t) => t.id === 'thr_demo');
  const agg = threads.find((t) => t.id === 'thr_agg');
  ok(first.changed === 3, 'marca los tres hilos no verificables', String(first.changed));
  ok(first.discarded === 2, 'descarta los borradores de prospectos inventados o agregadores');
  ok(generic.unverified && generic.stage === 'perdido', 'el prospecto inventado sale de la bandeja activa');
  ok(generic.drafts[0].status === 'descartado', 'su borrador queda descartado');
  ok(agg.unverified && agg.stage === 'perdido', 'un agregador histÃ³rico tambiÃ©n se descarta');
  ok(!agg.unverifiedReason || /agregador/i.test(agg.unverifiedReason), 'explica por quÃ© era invÃ¡lido');
  ok(unverified.unverified && unverified.stage === 'nuevo', 'el nombre real sin contacto queda para revisar, no se borra');
  ok(unverified.drafts[0].status === 'revisar', 'su borrador pasa a revisiÃ³n con nota');
  ok(!real.unverified, 'un hilo con email real no se toca');
  ok(!demo.unverified && demo.drafts[0].status === 'listo', 'los ejemplos demo no se tocan');
  const second = await sanitizeLegacyThreads(store);
  ok(second.changed === 0, 'la migraciÃ³n es idempotente');
}

/* 5. CreaciÃ³n de hilos: solo compradores verificados y con la trazabilidad. */
{
  const store = await freshStore();
  const product = { id: 'prod_test', name: 'SIRI Velador' };
  const mission = {
    id: 'mis_flow', demo: false, name: 'Prueba', depth: 'estandar', maxProspects: 12, productId: product.id,
    steps: [{ id: 'compliance', status: 'done' }, { id: 'redteam', status: 'done' }],
    artifacts: {
      prospecting: {
        compradores: [
          {
            nombre: 'Avanluce', tipo: 'tienda', pais: 'EspaÃ±a', ciudad: 'Barcelona', web: 'https://www.avanluce.com',
            email: '', email_estado: 'desconocido', prioridad: 'alta', verificado: true,
            web_estado: 'verificado', web_titulo: 'Avanluce', fuente_verificada: 'https://www.avanluce.com/', origen: 'fuentes',
          },
          {
            nombre: 'Fantasma GenÃ©rico', tipo: 'tienda', web: '', email: '', verificado: false,
          },
        ],
      },
      outreach: { mensajes: [{ comprador: 'Avanluce', pais: 'EspaÃ±a', idioma: 'es', asunto: 'SIRI para Avanluce', cuerpo: 'Hola Avanluce: les acerco SIRI, un velador impreso en 3D. Â¿Les mando la ficha? Si preferÃ­s no recibir mÃ¡s mensajes, respondÃ© BAJA.' }] },
      synthesis: { mensajes_listos: [] },
      compliance: { veredicto: 'aprobado', correcciones: [] },
      redteam: { veredicto: 'avanzar' },
    },
  };
  const result = await createThreads(mission, product, store.settings(), store);
  const threads = store.get('threads');
  ok(result.created === 1, 'crea un solo hilo: el comprador verificado', String(result.created));
  const thread = threads.find((t) => t.contact.company === 'Avanluce');
  ok(thread && thread.verification?.webEstado === 'verificado', 'guarda la verificaciÃ³n en el hilo');
  ok(thread.contact.website === 'https://www.avanluce.com', 'guarda el sitio real');
  ok(thread.drafts[0].channel === 'formulario', 'sin email pÃºblico, el borrador es para formulario');
  ok(/formulario|sitio/i.test(thread.nextStep || ''), 'el siguiente paso explica que no hay email verificado', thread.nextStep);
  ok(mission.stats.prospects === 1, 'las estadÃ­sticas cuentan solo los compradores verificados', String(mission.stats.prospects));
  ok(mission.stats.emails === 0, 'no cuenta emails inexistentes');
  ok(!threads.some((t) => t.contact.company === 'Fantasma GenÃ©rico'), 'no crea hilos de compradores no verificados');
  ok(mission.skippedProspects.some((item) => /verificar/i.test(item.reason)), 'deja constancia del comprador no verificado');
}

/* 6. MisiÃ³n sin compradores: la app lo dice, no lo disimula. */
{
  const store = await freshStore();
  const product = { id: 'prod_test', name: 'SIRI Velador' };
  const mission = {
    id: 'mis_empty', demo: false, name: 'Sin compradores', depth: 'estandar', maxProspects: 12, productId: product.id,
    steps: [{ id: 'compliance', status: 'done' }, { id: 'redteam', status: 'done' }],
    artifacts: {
      prospecting: { compradores: [], descartados: [{ nombre: 'Hotel boutique', motivo: 'genÃ©rico' }], verificacion: { candidatos: 3, verificados: 0, descartados: 3 } },
      outreach: { mensajes: [] },
      synthesis: { mensajes_listos: [] },
      compliance: { veredicto: 'aprobado', correcciones: [] },
      redteam: { veredicto: 'avanzar' },
    },
  };
  const result = await createThreads(mission, product, store.settings(), store);
  ok(result.created === 0, 'no crea hilos sin compradores verificados');
  ok(mission.notices.some((notice) => notice.type === 'no-prospects' && /no hay ventas posibles/i.test(notice.text)), 'avisa que no hay ventas posibles');
  ok(mission.stats.prospects === 0, 'las estadÃ­sticas dicen 0 compradores');
}

/* 7. Red team "detener": advertencia fuerte, no bloqueo permanente. */
{
  const store = await freshStore();
  const product = { id: 'prod_test', name: 'SIRI Velador' };
  const mission = {
    id: 'mis_redteam', demo: false, name: 'Red team detener', depth: 'estandar', maxProspects: 12, productId: product.id,
    steps: [{ id: 'compliance', status: 'done' }, { id: 'redteam', status: 'done' }],
    artifacts: {
      prospecting: {
        compradores: [{
          nombre: 'Avanluce', tipo: 'tienda', pais: 'EspaÃ±a', ciudad: 'Barcelona', web: 'https://www.avanluce.com',
          email: 'info@avanluce.com', email_estado: 'publico', prioridad: 'alta', verificado: true, web_estado: 'verificado',
        }],
      },
      outreach: { mensajes: [{ comprador: 'Avanluce', pais: 'EspaÃ±a', idioma: 'es', asunto: 'SIRI para Avanluce', cuerpo: 'Hola Avanluce: les acerco SIRI. RespondÃ© BAJA si no te interesa.' }] },
      synthesis: { mensajes_listos: [] },
      compliance: { veredicto: 'aprobado', correcciones: [] },
      redteam: { veredicto: 'detener', sello: 'El flete no estÃ¡ medido.' },
    },
  };
  await createThreads(mission, product, store.settings(), store);
  const thread = store.get('threads')[0];
  ok(thread.drafts[0].status === 'revisar', 'un detener del red team deja el borrador Por aprobar');
  ok(/red team/i.test(thread.drafts[0].reviewNote || ''), 'explica que el red team pidiÃ³ detener', thread.drafts[0].reviewNote);
  ok(mission.notices.some((notice) => notice.type === 'redteam'), 'la misiÃ³n avisa del detener');
  ok(mission.stats.draftsToReview === 1, 'las estadÃ­sticas no dicen que hay borradores listos');

  // El dueÃ±o asume el riesgo y aprueba: revalidar no debe borrar esa decisiÃ³n
  // mientras el texto y la advertencia sigan siendo los mismos.
  thread.drafts[0].approvedAt = new Date().toISOString();
  thread.drafts[0].approvedBy = 'dueÃ±o';
  thread.drafts[0].approvedReviewKind = 'redteam';
  thread.drafts[0].status = 'listo';
  await store.set('threads', store.get('threads'));
  await reconcileThreads(mission, product, store.settings(), store);
  ok(store.get('threads')[0].drafts[0].status === 'listo', 'revalidar respeta una aprobaciÃ³n explÃ­cita del dueÃ±o');
}

/* Una misiÃ³n lanzada con un temporizador en memoria queda "running" para
   siempre si Lumbre se cierra. DespuÃ©s bloquea reintentos, backups y borrado
   del producto. Al arrancar, se libera y vuelve a ser reintentable. */
{
  const store = await freshStore();
  const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  store.get('missions').unshift(
    {
      id: 'mis_colgada',
      name: 'Prueba',
      status: 'running',
      phase: 'prospeccion',
      currentStep: 'prospecting',
      createdAt: old,
      startedAt: old,
      updatedAt: old,
      steps: [
        { id: 'brief', title: 'Brief y tesis comercial', status: 'done' },
        { id: 'prospecting', title: 'Compradores concretos', status: 'running' },
        { id: 'customs', title: 'Aduanas y logÃ­stica', status: 'pending' },
      ],
    },
    {
      id: 'mis_nueva',
      name: 'En curso',
      status: 'running',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      steps: [{ id: 'brief', title: 'Brief', status: 'running' }],
    },
  );
  const result = await releaseInterruptedMissions(store);
  const stale = store.find('missions', 'mis_colgada');
  ok(result.released === 1 && result.ids[0] === 'mis_colgada', 'libera solo la misiÃ³n abandonada');
  ok(stale.status === 'error' && stale.phase === 'error', 'la misiÃ³n abandonada queda reintentable');
  ok(/Reintent/i.test(stale.error || ''), 'el error dice cÃ³mo retomarla', stale.error);
  ok(stale.steps.find((s) => s.id === 'prospecting').status === 'error', 'marca el paso que quedÃ³ a medias');
  ok(store.find('missions', 'mis_nueva').status === 'running', 'no toca una misiÃ³n que reciÃ©n arranca');
  const again = await releaseInterruptedMissions(store);
  ok(again.released === 0, 'la limpieza es idempotente');
}

/* Las misiones en cola nunca empezaron: no hay nada que liberar. Si se
   marcaran como error, una campaña de 20 productos quedaría rota tras
   cualquier reinicio. Se dejan intactas para que el arranque las retome. */
{
  const store = await freshStore();
  const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  await store.set('missions', [{
    id: 'mis_queued',
    name: 'En cola',
    status: 'queued',
    phase: 'queued',
    createdAt: old,
    startedAt: null,
    updatedAt: old,
    steps: [{ id: 'brief', title: 'Brief', status: 'pending' }],
  }]);
  const result = await releaseInterruptedMissions(store);
  const queued = store.find('missions', 'mis_queued');
  ok(result.released === 0, 'no libera una mision que nunca empezo');
  ok(queued.status === 'queued', 'la deja en cola para retomarla al arrancar');
}
for (const dir of dirs) {
  await fs.rm(dir, { recursive: true, force: true });
}
console.log(`\n${passed} comprobaciones del flujo OK`);
