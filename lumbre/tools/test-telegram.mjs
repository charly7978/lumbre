import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { Store } from '../lib/store.mjs';
import { Notifier } from '../lib/notify.mjs';
import { parseAction, executeAction, ACTION_SPECS } from '../lib/telegram-actions.mjs';
import { searchWebDetailed } from '../lib/search.mjs';
import { askPrompt } from '../lib/prompts.mjs';
import { probeLocalAI } from '../lib/connections.mjs';
import { Outbox } from '../lib/outbox.mjs';

// parseAction tests
{
  const r = parseAction('Hola ```json\n{"accion":{"tipo":"buscar","args":{"query":"lamparas Madrid","limit":3},"resumen":"buscar","requiere_accion":true}}\n```');
  if (!r.action || r.action.tipo !== 'buscar') throw new Error('parseAction fenced failed');
  if (r.action.args.query !== 'lamparas Madrid') throw new Error('query mismatch');
  if (r.action.args.limit !== 3) throw new Error('limit mismatch');
}
{
  const r = parseAction('texto {"accion":{"tipo":"buscar","args":{"query":"x"},"resumen":"b","requiere_accion":true}} mas');
  if (!r.action) throw new Error('parseAction embedded failed');
}
{
  const r = parseAction('{"accion":{"tipo":"noexiste","args":{},"requiere_accion":true}}');
  if (r.action !== null) throw new Error('unknown type should be null');
}
{
  const r = parseAction('{"accion":{"tipo":"buscar","args":{},"requiere_accion":true}}');
  if (r.action !== null) throw new Error('missing args should be null');
}
{
  const r = parseAction('sin json aqui');
  if (r.action !== null) throw new Error('no json should be null');
}
console.log('parseAction OK');

// executeAction buscar
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  const res = await executeAction({
    action: { tipo: 'buscar', args: { query: 'lamparas', limit: 2 }, resumen: '', requiere_accion: true },
    store,
    actions: {},
    chatId: '1',
    search: async () => ({ results: [{ title: 'T', url: 'https://x.com', snippet: 's' }], engine: 'tavily', errors: [] }),
  });
  if (!res.ok) throw new Error('buscar execute failed: ' + res.message);
  if (!/https:\/\/x.com/.test(res.message)) throw new Error('fuente missing');
  await fs.rm(dir, { recursive: true, force: true });
}
// query vacia
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  const res = await executeAction({
    action: { tipo: 'buscar', args: { query: '', limit: 2 }, resumen: '', requiere_accion: true },
    store, actions: {}, chatId: '1',
    search: async () => ({ results: [], engine: '', errors: [] }),
  });
  // validation fails before execute
  if (res.ok) throw new Error('empty query should fail');
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('executeAction buscar OK');

// enviar_borrador calls handler with confirm:true
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  await store.saveSettings({ email: { provider: 'resend', resendKey: 'test-only', from: 'ventas@example.com' } });
  let called = null;
  const actions = { sendThreadMessage: async (tid, body) => {
    called = { tid, body };
    return { thread: { contact: { company: 'Tienda prueba' } }, message: { id: 'msg-test', status: 'enviado', channel: 'resend' } };
  } };
  const res = await executeAction({
    action: { tipo: 'enviar_borrador', args: { threadId: 't1', draftId: 'd1' }, resumen: '', requiere_accion: true },
    store, actions, chatId: '1',
  });
  if (!res.ok || !/realmente enviado/.test(res.message)) throw new Error('enviar failed: ' + res.message);
  if (!called || called.body.confirm !== true || called.body.channel !== 'resend') throw new Error('proveedor real no utilizado');
  await fs.rm(dir, { recursive: true, force: true });
}
// No atribuirse envíos si el proveedor es manual.
{
  const dir = path.join(os.tmpdir(), `lucian-tg-manual-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  let called = false;
  const res = await executeAction({
    action: { tipo: 'enviar_borrador', args: { threadId: 't1', draftId: 'd1' }, requiere_accion: true },
    store,
    actions: { sendThreadMessage: async () => { called = true; return {}; } },
    chatId: '1',
  });
  if (res.ok || called || !/no envié|No envié/.test(res.message)) throw new Error('El modo manual simula un envío.');
  await fs.rm(dir, { recursive: true, force: true });
}

console.log('enviar_borrador OK');

// lanzar_mision calls createMission
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  let called = null;
  const actions = { createMission: async (body) => { called = body; return { id: 'm1', name: 'Mision' }; } };
  const res = await executeAction({
    action: { tipo: 'lanzar_mision', args: { productId: 'p1', markets: ['España'] }, resumen: '', requiere_accion: true },
    store, actions, chatId: '1',
  });
  if (!res.ok) throw new Error('lanzar failed: ' + res.message);
  if (!called || called.productId !== 'p1') throw new Error('createMission not called');
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('lanzar_mision OK');

// unknown type
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  const res = await executeAction({
    action: { tipo: 'foo', args: {}, resumen: '', requiere_accion: true },
    store, actions: {}, chatId: '1',
  });
  if (res.ok) throw new Error('unknown should fail');
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('unknown type OK');

// Notifier handleOwnerText
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  const ask = async (q, channel, history) => 'Respuesta del equipo.';
  const notifier = new Notifier({ store, ask, actions: {} });
  // solo chatId dueño: otros chats ignorados
  store.get('settings').notify.telegram = { enabled: true, token: 't', chatId: '42' };
  await store.saveSettings(store.get('settings'));
  const r1 = await notifier.handleOwnerText('hola', 'telegram', '99');
  if (r1 !== '') throw new Error('other chat should be ignored, got: ' + r1);
  const r2 = await notifier.handleOwnerText('/start', 'telegram', '42');
  if (!r2) throw new Error('start empty');
  // automatic action via ask returning action? ask returns plain text, no action
  const r3 = await notifier.handleOwnerText('¿cómo venimos?', 'telegram', '42');
  if (!r3) throw new Error('empty reply');
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('Notifier basic OK');

// confirm flow
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  store.get('settings').notify.telegram = { enabled: true, token: 't', chatId: '42' };
  await store.saveSettings(store.get('settings'));
  const ask = async (q, channel, history) => '{"accion":{"tipo":"enviar_borrador","args":{"threadId":"t1","draftId":"d1"},"resumen":"enviar","requiere_accion":true}}';
  let sent = null;
  const actions = { sendThreadMessage: async (tid, body) => { sent = { tid, body }; return { message: 'enviado' }; } };
  const notifier = new Notifier({ store, ask, actions });
  const r1 = await notifier.handleOwnerText('mandá el mail', 'telegram', '42');
  if (!/confirmar/i.test(r1)) throw new Error('should ask confirm: ' + r1);
  // confirm
  const r2 = await notifier.handleOwnerText('confirmar', 'telegram', '42');
  if (!sent) throw new Error('not sent on confirm');
  // cancel scenario
  const ask2 = async () => '{"accion":{"tipo":"enviar_borrador","args":{"threadId":"t1","draftId":"d1"},"resumen":"enviar","requiere_accion":true}}';
  const n2 = new Notifier({ store, ask: ask2, actions });
  await n2.handleOwnerText('mandá el mail', 'telegram', '42');
  const r3 = await n2.handleOwnerText('cancelar', 'telegram', '42');
  if (!/cancelado/i.test(r3)) throw new Error('cancel failed: ' + r3);
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('confirm flow OK');

// /reiniciar
{
  const dir = path.join(os.tmpdir(), `lucian-tg-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  store.get('settings').notify.telegram = { enabled: true, token: 't', chatId: '42' };
  await store.saveSettings(store.get('settings'));
  const notifier = new Notifier({ store, ask: async () => 'x', actions: {} });
  await notifier.handleOwnerText('hola', 'telegram', '42');
  const r = await notifier.handleOwnerText('/reiniciar', 'telegram', '42');
  if (!/reiniciado/i.test(r)) throw new Error('reiniciar failed');
  const sessions = store.get('telegramSessions');
  if (sessions['42'].history.length !== 0) throw new Error('history not cleared');
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('reiniciar OK');

// askPrompt includes history
{
  const ctx = { marca: {} };
  const out = askPrompt('director', 'q', ctx, { history: [{ role: 'user', text: 'prev' }], channel: 'telegram' });
  if (!/CONVERSACION RECIENTE/.test(out) && !/CONVERSACIÓN RECIENTE/.test(out)) throw new Error('history not included');
  if (!/no puedo/.test(out) === false) {}
}
console.log('askPrompt OK');


/* Regresión: el operador debe poder consultar datos reales sin consumir IA
   y el estado de Telegram debe explicitar si existe recepción activa. */
{
  const dir = path.join(os.tmpdir(), `lucian-ops-test-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  await store.saveSettings({ notify: { telegram: { enabled: true, token: 'test-token', chatId: '42' } } });
  await store.set('products', [{
    id: 'prod-real', name: 'Lámpara prueba real', status: 'activo',
    price: 100, photos: [], description: 'Pieza artesanal de prueba con pantalla de impresión 3D.',
  }]);
  await store.set('threads', [{
    id: 'thread-real', demo: false, stage: 'interesado',
    contact: { company: 'Estudio de Interiorismo', email: 'contacto@example.com' },
    nextStep: 'Enviar ficha y cotización',
    drafts: [{ id: 'd1', status: 'revisar' }],
    messages: [{ direction: 'in', body: 'Quisiera una cotización', at: new Date().toISOString() }],
  }, {
    id: 'thread-demo', demo: true, stage: 'interesado',
    contact: { company: 'Cliente inventado', email: 'demo@example.com' },
    drafts: [], messages: [],
  }]);
  const notifier = new Notifier({ store, ask: async () => { throw new Error('No debe usarse IA'); } });
  const diagnostic = await notifier.handleOwnerText('/diagnostico', 'telegram', '42');
  if (!/Escuchando: no/.test(diagnostic)) throw new Error('El diagnóstico no revela la falta de polling');
  const agenda = await notifier.handleOwnerText('/prioridades', 'telegram', '42');
  if (!/Lámpara prueba real/.test(agenda) || !/Estudio de Interiorismo/.test(agenda)) {
    throw new Error('No se muestran las prioridades comerciales verificables');
  }
  const opportunities = await notifier.handleOwnerText('/oportunidades', 'telegram', '42');
  if (!/Estudio de Interiorismo/.test(opportunities) || /Cliente inventado/.test(opportunities)) {
    throw new Error('Las oportunidades no excluyen datos demo');
  }
  await store.flush();
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('Comandos operativos y separación demo/real OK');

/* IA local: reconocer un modelo descargado aun cuando el nombre sugerido
   en Ajustes no exista. Se usa una respuesta simulada, nunca red real. */
{
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true, json: async () => ({ models: [{ name: 'qwen2.5-coder:3b' }] }),
    });
    const local = await probeLocalAI({
      fallback: { enabled: true, ollama: { baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:3b' } },
    }, { fresh: true });
    if (!local.ok || local.model !== 'qwen2.5-coder:3b' || !local.substituted) {
      throw new Error('No se detectó el modelo Ollama instalado.');
    }
  } finally {
    globalThis.fetch = original;
  }
}
console.log('Fallback local comprobable OK');

/* El piloto activo debe recuperar un borrador histórico aprobado UNA sola
   vez, sin fabricar un envío ni contactar un correo de ejemplo. */
{
  const dir = path.join(os.tmpdir(), `lucian-outbox-test-${Date.now()}`);
  const store = new Store(dir);
  await store.init();
  await store.saveSettings({ email: { autopilot: true, provider: 'resend', resendKey: 'test', from: 'ventas@lucian.com' } });
  await store.set('threads', [{
    id: 'hilo-1', demo: false, stage: 'nuevo',
    contact: { company: 'Tienda comprobable', email: 'compras@tienda-real.test' },
    drafts: [{ id: 'borrador-1', status: 'listo', channel: 'email', subject: 'Consulta', body: 'Correo preparado.' }],
    messages: [],
  }]);
  const outbox = new Outbox({ store, deliver: async () => ({ ok: true }) });
  const first = await outbox.enqueueAllReady();
  const again = await outbox.enqueueAllReady();
  if (first.queued !== 1 || again.queued !== 0 || outbox.items().length !== 1) {
    throw new Error('Encolar duplicó un envío aprobado.');
  }
  await store.flush();
  await fs.rm(dir, { recursive: true, force: true });
}
console.log('Recuperación de borradores y antiduplcado OK');



console.log('\\n test-telegram OK');
