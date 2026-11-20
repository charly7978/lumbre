import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(os.tmpdir(), `lumbre-api-${Date.now()}`);
const base = 'http://127.0.0.1:4399';

async function waitForHealth(timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch { /* todavía arranca */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor de prueba no respondió.');
}

function run(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      stdio: 'inherit',
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '4399', LUMBRE_DATA_DIR: dataDir, LUMBRE_NO_OPEN: '1' },
  stdio: 'inherit',
});

let exitCode = 1;
try {
  await waitForHealth();
  exitCode = await run(['tools/test-api.mjs']);
} catch (error) {
  console.error(error.message);
} finally {
  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 400));
  await fs.rm(dataDir, { recursive: true, force: true }).catch(() => {});
}

process.exit(exitCode);
