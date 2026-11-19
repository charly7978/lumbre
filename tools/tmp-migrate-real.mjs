import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from '../lib/store.mjs';
import { migrateLegacyDrafts, sanitizeLegacyThreads } from '../lib/agents.mjs';

const dataDir = path.resolve('data');
const backupDir = path.join(dataDir, 'backups', `pre-verificacion-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
await fs.mkdir(backupDir, { recursive: true });
for (const file of ['threads.json', 'missions.json', 'activity.json', 'settings.json']) {
  await fs.copyFile(path.join(dataDir, file), path.join(backupDir, file)).catch(() => {});
}
console.log('BACKUP', backupDir);

const store = new Store(dataDir);
await store.init();
console.log('BEFORE threads', store.get('threads').length, 'missions', store.get('missions').length);
const drafts = await migrateLegacyDrafts(store);
const sanitized = await sanitizeLegacyThreads(store);
console.log('MIGRATION drafts', JSON.stringify(drafts), 'unverified', JSON.stringify(sanitized));
const threads = store.get('threads');
const real = threads.filter((thread) => !thread.demo);
console.log('REAL THREADS', real.length);
for (const thread of real) {
  console.log('-', thread.contact?.company, '|', thread.contact?.email || '(sin email)', '|', thread.stage, '| unverified:', Boolean(thread.unverified), '| drafts:', (thread.drafts || []).map((draft) => draft.status).join(','));
}
console.log('MISSIONS', store.get('missions').slice(0, 4).map((mission) => `${mission.id}:${mission.status}`).join(' '));
