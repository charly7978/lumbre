import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = await mkdtemp(path.join(os.tmpdir(), 'lucian-comercial-http-'));
const port = 48000 + Math.floor(Math.random() * 10000);
const base = `http://127.0.0.1:${port}`;
const proc = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), LUCIAN_DATA_DIR: data, LUCIAN_NO_OPEN: '1', LUCIAN_HOST: '127.0.0.1' },
  stdio: 'ignore',
});
async function request(pathname, payload) {
  const response = await fetch(base + pathname, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  return { status: response.status, data: await response.json() };
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { ready = (await fetch(base + '/api/health')).ok; if (ready) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  assert.equal(ready, true, 'El servidor debe arrancar');
  const before = (await request('/api/state')).data;
  assert.equal((await request('/api/commercial/strategy', { productId: 'x' })).status, 400);
  assert.equal((await request('/api/commercial/strategy', { productId: 'x', confirmResearch: true })).status, 400);
  const after = (await request('/api/state')).data;
  assert.deepEqual(after.counts, before.counts, 'La investigación no crea misiones ni mensajes');
  console.log('OK HTTP: confirmación obligatoria, producto válido, sin efectos comerciales.');
} finally {
  proc.kill();
  await new Promise((resolve) => {
    if (proc.exitCode !== null) return resolve();
    proc.once('exit', resolve);
    setTimeout(resolve, 1200);
  });
  await rm(data, { recursive: true, force: true });
}
