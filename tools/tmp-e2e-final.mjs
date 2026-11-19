import fs from 'node:fs';
import path from 'node:path';

const base = 'http://127.0.0.1:4403';
const outDir = fs.readFileSync('C:\\Users\\carlo.ROLITO\\AppData\\Local\\Temp\\lumbre-final-path.txt', 'utf8').trim();

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
    markets: ['España'],
    goal: 'conseguir-mayoristas',
    notes: 'Validación final del flujo honesto',
  }),
});
const id = created.mission.id;
console.log('MISSION', id, JSON.stringify(created.mission.markets));

let mission = null;
for (let i = 0; i < 150; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 8000));
  mission = (await api(`/api/missions/${id}`)).mission;
  console.log(`${mission.status} | ${mission.progress}% | ${mission.currentStep || '-'}`);
  if (['done', 'done_with_warnings', 'error', 'cancelled'].includes(mission.status)) break;
}

const detail = await api(`/api/missions/${id}`);
fs.writeFileSync(path.join(outDir, 'mission.json'), JSON.stringify(detail, null, 2));
console.log('FINAL', mission.status);
console.log('WARNINGS', JSON.stringify(mission.warnings || []));
console.log('NOTICES', JSON.stringify(mission.notices || []));
console.log('STATS', JSON.stringify(mission.stats));
console.log('REDTEAM', mission.artifacts?.redteam?.veredicto, '|', mission.artifacts?.redteam?.sello);
console.log('PRICING', mission.artifacts?.pricing?.recomendacion);
const messages = mission.artifacts?.outreach?.mensajes || [];
console.log('MESSAGES', messages.length, '| wholesale mentions:', messages.filter((m) => /mayorista|wholesale/i.test(m.cuerpo || '')).length);
for (const thread of detail.threads) {
  console.log('THREAD', thread.contact?.company, '|', thread.contact?.email || '(sin email)', '|', thread.stage, '| draft:', thread.draftPreview?.status, '|', (thread.draftPreview?.reviewNote || '').slice(0, 120));
}
console.log('DRAFTS', JSON.stringify(mission.stats?.draftsReady), JSON.stringify(mission.stats?.draftsToReview), JSON.stringify(mission.stats?.draftsBlocked));
