/* ============================================================
   Piloto de conexiones: los agentes hacen TODO lo que pueden
   sin intervención humana:
   - Revisa conexiones periódicamente.
   - Detecta fallo de IA y activa el respaldo (ya lo hace connections.mjs).
   - Reintenta conexiones caídas.
   - Avisa por Telegram cuando algo cambia.
   - Se autolimpia cuando el proveedor principal vuelve a responder.
   ============================================================ */
import { diagnoseConnections, getAiFailoverState, resetAiFailover } from './connections.mjs';
import { isAIReady, testAI, resolveAIConfig } from './ai.mjs';

const state = {
  lastCheck: null,
  lastIssues: [],
  checks: 0,
  recoveryAttempts: 0,
};

export function getAutopilotState() {
  return {
    ...state,
    aiFailover: getAiFailoverState(),
  };
}

/**
 * Ejecuta una pasada del piloto.
 * @returns {object} resultado con acciones tomadas
 */
export async function runAutopilot(store, notifier, logger = () => {}) {
  const settings = store.settings();
  if (settings.autopilot?.enabled === false) {
    return { enabled: false, actions: [] };
  }

  state.checks += 1;
  state.lastCheck = new Date().toISOString();
  const actions = [];
  const report = await diagnoseConnections(settings, store);
  const issues = report.connections.filter((c) => !c.ok);

  // 1) Si la IA principal está caída pero hay respaldo configurado, avisar
  const ai = report.connections.find((c) => c.id === 'ai');
  const fallback = report.connections.find((c) => c.id === 'fallback');
  const fo = report.aiFailover;

  if (fo.fallbackActive && !state.lastIssues.includes('ai-fallback')) {
    actions.push('IA de respaldo activada automáticamente');
    await notify(notifier, '🔄 El piloto activó la IA de respaldo (Ollama local) porque el proveedor principal falló. Seguís vendiendo sin cortes.');
    state.lastIssues.push('ai-fallback');
  }
  if (!fo.fallbackActive && state.lastIssues.includes('ai-fallback')) {
    actions.push('IA principal recuperada');
    await notify(notifier, '✅ El proveedor de IA principal volvió a responder. Lucian está usando la IA original otra vez.');
    state.lastIssues = state.lastIssues.filter((x) => x !== 'ai-fallback');
  }

  // 2) Si faltan conexiones críticas, avisar una sola vez
  const critical = issues.filter((c) => ['email', 'inbox', 'telegram'].includes(c.id));
  for (const c of critical) {
    const key = 'missing-' + c.id;
    if (!state.lastIssues.includes(key)) {
      actions.push(`Falta ${c.name}`);
      await notify(notifier, `⚠️ *Lucian necesita una conexión*\n\n${c.name}: ${c.detail}\n\nConfigurala en Ajustes → Correo/Notificaciones. El piloto seguirá intentando igual.`);
      state.lastIssues.push(key);
    }
  }

  // 3) Si el respaldo no está configurado pero la IA principal falló mucho, avisar
  if (!fallback?.ok && fo.primaryFailures >= 1 && !state.lastIssues.includes('no-fallback')) {
    actions.push('Sin respaldo configurado');
    await notify(notifier, '🛡️ Tu IA tuvo fallos y no hay respaldo configurado. Recomendación: activar Ollama en Ajustes → Conexiones para no quedar sin cerebro.');
    state.lastIssues.push('no-fallback');
  }

  // 4) Limpiar avisos de conexiones que ya se resolvieron
  for (let i = state.lastIssues.length - 1; i >= 0; i -= 1) {
    const key = state.lastIssues[i];
    if (key.startsWith('missing-')) {
      const id = key.replace('missing-', '');
      if (!issues.find((c) => c.id === id)) {
        actions.push(`Resuelta: ${id}`);
        state.lastIssues.splice(i, 1);
      }
    }
  }

  if (actions.length) logger(`[Piloto] ${actions.join(' | ')}`);
  return { enabled: true, actions, issues: issues.map((c) => c.id), state: getAutopilotState() };
}

async function notify(notifier, text) {
  if (!notifier?.notify) return;
  try { await notifier.notify(text, { kind: 'system' }); } catch { /* silencio */ }
}

export function startAutopilot(store, notifier, logger) {
  const settings = store.settings();
  const every = Math.max(1, Math.min(60, Number(settings.autopilot?.intervalMinutes) || 10)) * 60 * 1000;
  const timer = setInterval(() => runAutopilot(store, notifier, logger), every);
  timer.unref?.();
  // Primera pasada al arrancar
  setTimeout(() => runAutopilot(store, notifier, logger), 8000).unref?.();
  return timer;
}
