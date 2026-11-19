import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const base = 'http://127.0.0.1:4400';
const outDir = 'C:\\Users\\carlo.ROLITO\\AppData\\Local\\Temp\\dsh-5SAZ9H\\lumbre-e2e-3138bdf3';

async function api(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!response.ok) throw new Error(`${response.status} ${data?.error || text}`);
  return data;
}

const created = await api('/api/missions', {
  method: 'POST',
  body: JSON.stringify({
    productId: 'prd_8ecb7702a6de',
    mode: 'real',
    depth: 'estandar',
    markets: ['España', 'México', 'Estados Unidos'],
    goal: 'conseguir-mayoristas',
    notes: 'Misión de verificación end-to-end (flujo honesto)',
  }),
});
const id = created.mission.id;
console.log('MISSION', id, JSON.stringify(created.mission.markets));
fs.writeFileSync(path.join(outDir, 'mission-id.txt'), id);

let mission = null;
for (let i = 0; i < 150; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 8000));
  mission = (await api(`/api/missions/${id}`)).mission;
  console.log(`${mission.status} | ${mission.progress}% | ${mission.phase} | ${mission.currentStep || '-'} | buyers=${mission.stats?.prospects ?? '-'} | threads=${mission.stats?.createdThreads ?? '-'}`);
  if (['done', 'done_with_warnings', 'error', 'cancelled'].includes(mission.status)) break;
}

const detail = await api(`/api/missions/${id}`);
fs.writeFileSync(path.join(outDir, 'mission.json'), JSON.stringify(detail, null, 2));
console.log('FINAL', mission.status);
console.log('ERROR', mission.error || '(sin error)');
console.log('WARNINGS', JSON.stringify(mission.warnings || []));
console.log('NOTICES', JSON.stringify(mission.notices || []));
console.log('STATS', JSON.stringify(mission.stats));
for (const thread of detail.threads) {
  console.log('THREAD', thread.contact?.company, '|', thread.contact?.email || '(sin email)', '|', thread.stage, '| drafts:', JSON.stringify((thread.draftPreview ? [thread.draftPreview.status] : [])));
}
const buyers = mission.artifacts?.prospecting?.compradores || [];
console.log('BUYERS');
for (const buyer of buyers) console.log(' -', buyer.nombre, '|', buyer.web || '(sin web)', '|', buyer.web_estado, '|', buyer.email || '(sin email)', '|', buyer.email_estado, '|', buyer.origen);
console.log('DISCARDED', (mission.artifacts?.prospecting?.descartados || []).length);
for (const item of (mission.artifacts?.prospecting?.descartados || []).slice(0, 20)) console.log(' x', item.nombre, '|', item.motivo);
console.log('SEARCH', JSON.stringify(mission.artifacts?.prospecting?.busqueda || {}));
console.log('VERIFICACION', JSON.stringify(mission.artifacts?.prospecting?.verificacion || {}));
