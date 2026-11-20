/* ============================================================
   Gestión inteligente de conexiones y credenciales.
   - Diagnostica el estado de cada integración.
   - Prueba conexiones reales.
   - Rota automáticamente a un proveedor de IA alternativo
     cuando el principal se queda sin cuota o falla.
   ============================================================ */
import { isAIReady, isRateLimitError, resolveAIConfig, testAI } from './ai.mjs';
import { testResend } from './email.mjs';
import { fetchNewEmails } from './imap.mjs';
import { searchWebDetailed } from './search.mjs';
import { testTelegram } from './notify.mjs';

/* Estado en memoria para el fallback de IA */
const aiState = {
  primaryFailures: 0,
  lastFailureAt: 0,
  fallbackActive: false,
  lastError: '',
};

export function getAiFailoverState() {
  return { ...aiState };
}

export function resetAiFailover() {
  aiState.primaryFailures = 0;
  aiState.lastFailureAt = 0;
  aiState.fallbackActive = false;
  aiState.lastError = '';
}

/**
 * Resuelve la configuración de IA a usar, aplicando fallback automático
 * a Ollama local si el proveedor principal falló por cuota/rate limit.
 * @returns {{cfg, isFallback: boolean, reason: string}}
 */
export function resolveAIWithFallback(settings) {
  const primary = resolveAIConfig(settings);
  const ollama = settings?.fallback?.ollama || {};
  const ollamaEnabled = settings?.fallback?.enabled !== false
    && ollama.baseUrl
    && ollama.model;

  // Si el principal no está listo y hay fallback configurado, usarlo directo
  if (!isAIReady(settings) && ollamaEnabled) {
    return {
      cfg: {
        provider: 'ollama',
        baseUrl: ollama.baseUrl,
        model: ollama.model,
        apiKey: '',
        temperature: primary.temperature,
        maxTokens: primary.maxTokens,
      },
      isFallback: true,
      reason: 'El proveedor principal no está configurado; se usa Ollama local.',
    };
  }

  // Si el fallo es reciente (< 10 min) y hay fallback, usarlo
  const recentFailure = aiState.lastFailureAt && (Date.now() - aiState.lastFailureAt) < 10 * 60 * 1000;
  if (recentFailure && aiState.primaryFailures >= 2 && ollamaEnabled) {
    return {
      cfg: {
        provider: 'ollama',
        baseUrl: ollama.baseUrl,
        model: ollama.model,
        apiKey: '',
        temperature: primary.temperature,
        maxTokens: primary.maxTokens,
      },
      isFallback: true,
      reason: `Proveedor principal con cuota agotada: ${aiState.lastError}`,
    };
  }

  return { cfg: primary, isFallback: false, reason: '' };
}

/** Registra un fallo de IA (para activar el fallback). */
export function recordAiFailure(error) {
  aiState.primaryFailures += 1;
  aiState.lastFailureAt = Date.now();
  aiState.lastError = String(error?.message || error || 'Error desconocido').slice(0, 300);
  if (aiState.primaryFailures >= 2) aiState.fallbackActive = true;
}

/** Registra un éxito de IA (resetea el contador de fallos). */
export function recordAiSuccess() {
  if (aiState.primaryFailures > 0) aiState.primaryFailures = Math.max(0, aiState.primaryFailures - 1);
}

/** Diagnostica el estado de todas las conexiones. */
export async function diagnoseConnections(settings, store) {
  const result = [];
  const aiCfg = resolveAIConfig(settings);
  result.push({
    id: 'ai',
    name: 'Inteligencia artificial',
    ok: isAIReady(settings),
    detail: isAIReady(settings) ? `${aiCfg.provider} · ${aiCfg.model}` : 'Sin configurar',
  });

  const email = settings?.email || {};
  let emailOk = false;
  let emailDetail = 'Sin configurar';
  if (email.provider === 'gmail' && email.smtpUser && email.smtpPassword) {
    emailOk = true;
    emailDetail = `Gmail · ${email.smtpUser}`;
  } else if (email.provider === 'resend' && email.resendKey) {
    emailOk = true;
    emailDetail = 'Resend';
  } else if (email.webhookUrl) {
    emailOk = true;
    emailDetail = 'Webhook';
  }
  result.push({ id: 'email', name: 'Correo saliente', ok: emailOk, detail: emailDetail });

  const imapOk = email.provider === 'gmail' && email.smtpUser && email.smtpPassword;
  result.push({
    id: 'inbox',
    name: 'Correo entrante',
    ok: imapOk,
    detail: imapOk ? `IMAP · cada ${email.imapPollMinutes || 2} min` : 'Requiere Gmail SMTP',
  });

  const search = settings?.search || {};
  result.push({
    id: 'search',
    name: 'Búsqueda web',
    ok: search.provider !== 'none',
    detail: search.provider === 'duckduckgo' && !search.apiKey ? 'SearXNG/DuckDuckGo (sin clave)' : (search.provider || 'duckduckgo'),
  });

  const notify = settings?.notify || {};
  const tg = notify.telegram || {};
  result.push({
    id: 'telegram',
    name: 'Telegram',
    ok: Boolean(tg.enabled && tg.token && tg.chatId),
    detail: tg.enabled ? 'Configurado' : 'Apagado',
  });

  const fallback = settings?.fallback || {};
  result.push({
    id: 'fallback',
    name: 'IA de respaldo (anti-cuota)',
    ok: Boolean(fallback.enabled !== false && fallback.ollama?.baseUrl && fallback.ollama?.model),
    detail: fallback.ollama?.model ? `${fallback.ollama.model} · ${fallback.ollama.baseUrl}` : 'Sin configurar (recomendado)',
  });

  return {
    connections: result,
    aiFailover: getAiFailoverState(),
  };
}

/** Prueba una conexión específica y devuelve resultado legible. */
export async function testConnection(id, settings) {
  try {
    if (id === 'ai') {
      const { cfg, isFallback, reason } = resolveAIWithFallback(settings);
      const r = await testAI({ ...settings, ai: { ...settings.ai, provider: cfg.provider, baseUrl: cfg.baseUrl, model: cfg.model, apiKey: cfg.apiKey } });
      return { ok: true, detail: `${r.model || cfg.model}${isFallback ? ' (fallback activo)' : ''}`, reason };
    }
    if (id === 'email') {
      const email = settings.email || {};
      if (email.provider === 'gmail' && email.smtpUser && email.smtpPassword) {
        return { ok: true, detail: `Gmail SMTP listo · ${email.smtpUser}` };
      }
      if (email.provider === 'resend' && email.resendKey) {
        const r = await testResend(settings);
        return { ok: true, detail: r?.detail || 'Resend OK' };
      }
      return { ok: false, detail: 'Configurá Gmail o Resend' };
    }
    if (id === 'inbox') {
      const email = settings.email || {};
      if (email.provider !== 'gmail' || !email.smtpUser || !email.smtpPassword) {
        return { ok: false, detail: 'La bandeja entrante requiere Gmail SMTP' };
      }
      const msgs = await fetchNewEmails({ user: email.smtpUser, appPassword: email.smtpPassword, limit: 1 });
      return { ok: true, detail: `IMAP OK · ${msgs.length} correo(s) nuevo(s)` };
    }
    if (id === 'search') {
      const d = await searchWebDetailed(settings, 'lámparas de diseño 3D', { count: 1 });
      return { ok: d.results.length > 0, detail: d.results.length ? `${d.results.length} resultado(s)` : (d.errors?.[0] || 'Sin resultados') };
    }
    if (id === 'telegram') {
      const r = await testTelegram(settings);
      return { ok: true, detail: r?.detail || 'Telegram OK' };
    }
    return { ok: false, detail: 'Conexión desconocida' };
  } catch (error) {
    return { ok: false, detail: String(error?.message || error).slice(0, 300) };
  }
}
