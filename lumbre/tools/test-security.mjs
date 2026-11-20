import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMetaSignature, hasDocumentedOptIn, resendIdempotencyKey } from '../lib/security.mjs';
import { sendWithResend } from '../lib/email.mjs';

const raw = Buffer.from('{"entry":[]}');
const appSecret = 'test-meta-app-secret-long-enough';
const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
assert.equal(verifyMetaSignature(raw, signature, appSecret), true);
assert.equal(verifyMetaSignature(raw, 'sha256=malformed', appSecret), false);
assert.equal(verifyMetaSignature(raw, signature, ''), false);
assert.equal(verifyMetaSignature(Buffer.from('{"entry":[1]}'), signature, appSecret), false);

const permission = { status: 'opted_in', source: 'manual', evidence: 'Formulario registrado 2026-11-20', capturedAt: new Date().toISOString() };
assert.equal(hasDocumentedOptIn({ permission }), true);
assert.equal(hasDocumentedOptIn({ permission: { status: 'opted_in' } }), false);
assert.equal(hasDocumentedOptIn({ permission: { ...permission, status: 'unknown' } }), false);
assert.equal(hasDocumentedOptIn({ email: 'public@business.test' }), false);
const key = resendIdempotencyKey('thread-1', 'draft-1');
assert.equal(key, resendIdempotencyKey('thread-1', 'draft-1'));
assert.notEqual(key, resendIdempotencyKey('thread-1', 'draft-2'));

await assert.rejects(
  sendWithResend({ email: { resendKey: 'test', from: 'Lucian <hi@mydomain.test>' } }, { from: 'hi@mydomain.test' }),
  /consentimiento/i,
);
const originalFetch = globalThis.fetch;
let captured;
try {
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return new Response('{"id":"mail_test"}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const message = {
    from: 'Lucian <hi@mydomain.test>', to: 'buyer@example.org',
    subject: 'Hola', text: 'Prueba', html: '<p>Prueba</p>',
    consentVerified: true, idempotencyKey: key,
  };
  const result = await sendWithResend({ email: { resendKey: 'test', from: message.from } }, message);
  assert.equal(result.id, 'mail_test');
  assert.equal(captured.options.headers['idempotency-key'], key);
  assert.equal(captured.url, 'https://api.resend.com/emails');
} finally {
  globalThis.fetch = originalFetch;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lucian-security-'));
const port = 45000 + Math.floor(Math.random() * 12000);
const accessToken = 'test-access-token-for-security-suite-2026';
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), LUCIAN_HOST: '127.0.0.1',
    LUCIAN_DATA_DIR: dataDir, LUCIAN_NO_OPEN: '1',
    LUCIAN_ACCESS_TOKEN: accessToken, META_APP_SECRET: appSecret,
    META_VERIFY_TOKEN: 'test-verify-token' },
  stdio: 'ignore',
});
// undici/fetch overrides the Host header. Use raw HTTP so Host spoofing tests are real.
async function request(route, { method = 'GET', headers = {}, body = null } = {}) {
  return await new Promise((resolve, reject) => {
    const client = http.request({
      hostname: '127.0.0.1', port, path: route, method, headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const status = res.statusCode || 0;
        resolve({
          status,
          ok: status >= 200 && status < 300,
          headers: { get: (key) => { const value = res.headers[String(key).toLowerCase()]; return Array.isArray(value) ? value.join('; ') : (value || null); } },
          text: async () => Buffer.concat(chunks).toString('utf8'),
        });
      });
      res.on('error', reject);
    });
    client.on('error', reject);
    if (body !== null) client.write(body);
    client.end();
  });
}
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error('El servidor de prueba se cerró.');
    try {
      const res = await request('/api/health');
      if (res.ok) return;
    } catch { /* booting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('No arrancó el servidor de prueba.');
}
try {
  await waitForServer();
  assert.equal((await request('/api/state')).status, 200, 'localhost debe conservar acceso');
  const host = 'security-test.trycloudflare.com';
  assert.equal((await request('/api/state', { headers: { host } })).status, 401, 'túnel debe requerir clave');
  assert.equal((await request('/api/state', {
    headers: { host: 'localhost', 'x-forwarded-for': '203.0.113.5' },
  })).status, 401, 'Host localhost falsificado con proxy debe requerir clave');
  assert.equal((await request('/api/state', { headers: { host: 'attacker.example.com' } })).status, 403);
  assert.equal((await request('/api/login', {
    method: 'POST', headers: { host, 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'incorrecto' }),
  })).status, 401);
  const loggedIn = await request('/api/login', {
    method: 'POST', headers: { host, 'content-type': 'application/json' },
    body: JSON.stringify({ token: accessToken }),
  });
  assert.equal(loggedIn.status, 200);
  const cookie = loggedIn.headers.get('set-cookie') || '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.equal((await request('/api/state', {
    headers: { host, cookie: 'lucian_access=' + accessToken },
  })).status, 200);
  const url = '/api/webhooks/whatsapp';
  assert.equal((await request(url, { method: 'POST', body: raw })).status, 401, 'firma ausente');
  assert.equal((await request(url, {
    method: 'POST', headers: { 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) }, body: raw,
  })).status, 401, 'firma incorrecta');
  assert.equal((await request(url, {
    method: 'POST', headers: { 'x-hub-signature-256': signature },
    body: Buffer.from('{"entry":[1]}'),
  })).status, 401, 'payload cambiado');
  assert.equal((await request(url, {
    method: 'POST', headers: { 'x-hub-signature-256': signature }, body: raw,
  })).status, 200, 'firma correcta');
  assert.equal((await request(url + '?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=ok')).status, 200);
  console.log('OK: autorización local/remota, Host falsificado, firma Meta, consentimiento e idempotencia Resend.');
} finally {
  if (server.exitCode === null) {
    const closed = new Promise((resolve) => {
      server.once('exit', resolve);
      setTimeout(resolve, 2500).unref();
    });
    server.kill();
    await closed;
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  await fs.rm(dataDir, { recursive: true, force: true });
}
