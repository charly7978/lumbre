import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lucian-sales-test-'));
const port = 47000 + Math.floor(Math.random() * 13000);
const origin = `http://127.0.0.1:${port}`;
const proc = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: String(port), LUCIAN_DATA_DIR: dir, LUCIAN_NO_OPEN: '1' }, stdio: 'ignore' });
async function request(route, body, method = 'GET', expected = 200) {
  const response = await fetch(origin + route, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
  return result;
}
try {
  let healthy = false;
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(origin + '/api/health')).ok) { healthy = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, 'Lucian debe iniciar');
  const product = (await request('/api/products', { name: 'Lámpara QA', price: 100, currency: 'USD' }, 'POST', 201)).product;
  const thread = (await request('/api/threads', { productId: product.id, contact: { company: 'Prueba', email: 'qa@ejemplo.test' } }, 'POST', 201)).thread;
  const quote = (await request(`/api/threads/${thread.id}/quotes`, { quantity: 2, approve: false }, 'POST', 201)).quote;
  const base = `/api/threads/${thread.id}/quotes/${quote.id}`;
  await request(`${base}/payments`, { method: 'transferencia', reference: 'REF-001', amount: 50, confirm: true }, 'POST', 409);
  await request(base, { status: 'aceptada' }, 'PATCH');
  assert.equal((await request('/api/state')).sales.revenue, 0, 'Aceptar no significa cobrar');
  await request(`${base}/payments`, { method: 'transferencia', reference: 'REF-001', amount: 50, confirm: false }, 'POST', 400);
  await request(`${base}/payments`, { method: 'transferencia', reference: 'REF-001', amount: 50, confirm: true }, 'POST', 201);
  const again = await request(`${base}/payments`, { method: 'transferencia', reference: 'REF-001', amount: 50, confirm: true }, 'POST');
  assert.equal(again.alreadyRecorded, true);
  assert.equal((await request('/api/state')).sales.revenue, 50);
  await request(base, { status: 'rechazada' }, 'PATCH', 409);
  await request(`${base}/payments`, { method: 'mercadopago', reference: 'REF-002', amount: 150, confirm: true }, 'POST', 201);
  const sales = (await request('/api/state')).sales;
  assert.equal(sales.revenue, 200);
  assert.equal(sales.unpaidAcceptedQuotes, 0);
  console.log('OK: aceptar, registrar cobro, saldo parcial, idempotencia, rechazo y total.');
} finally {
  proc.kill();
  await new Promise(resolve => { if (proc.exitCode !== null) return resolve(); proc.once('exit', resolve); setTimeout(resolve, 1200); });
  await fs.rm(dir, { recursive: true, force: true });
}
