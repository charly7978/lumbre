import { extractJson, fetchWithTimeout, humanError, sleep, truncate } from './util.mjs';

/* ─────────────────────────────────────────────────────────────
   Proveedores. La clave y el modelo siempre se pueden pisar a mano.
   `baseUrl` debe ser la raíz compatible con OpenAI (”¦/v1).
   ───────────────────────────────────────────────────────────── */

export const PROVIDERS = {
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    vision: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o'],
    keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Calidad muy buena y visión. Se paga por uso.',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4.1-mini',
    vision: 'openai/gpt-4.1-mini',
    models: ['openai/gpt-4.1-mini', 'anthropic/claude-sonnet-4.5', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat'],
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Una sola clave para muchos modelos. Ideal si querés comparar.',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    vision: 'claude-sonnet-4-5',
    models: ['claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-opus-4-1'],
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Muy bueno para redacción y análisis. Formato de API propio.',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    vision: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Tiene capa gratuita generosa. Usamos su endpoint compatible con OpenAI.',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    vision: '',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    keyUrl: 'https://console.groq.com/keys',
    note: 'Muy rápido y económico. No todos los modelos ven imágenes.',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    vision: '',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'Económico y competente en texto.',
  },
  mistral: {
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-large-latest',
    vision: '',
    models: ['mistral-large-latest', 'mistral-small-latest'],
    keyUrl: 'https://console.mistral.ai/api-keys',
    note: 'Buena opción europea.',
  },
  ollama: {
    label: 'Ollama (local)',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'llama3.1',
    vision: '',
    models: ['llama3.1', 'qwen2.5', 'mistral'],
    keyUrl: 'https://ollama.com/download',
    note: 'Gratis y privado, pero exige una computadora potente y Ollama abierto.',
  },
  pollinations: {
    label: 'Pollinations (gratis, sin clave)',
    baseUrl: 'https://text.pollinations.ai/openai',
    model: 'openai',
    vision: '',
    models: ['openai'],
    keyUrl: '',
    note: 'Gratis y sin registro. Calidad variable; para uso serio configurá un proveedor con clave.',
  },
  custom: {
    label: 'Otro compatible con OpenAI',
    baseUrl: '',
    model: '',
    vision: '',
    models: [],
    keyUrl: '',
    note: 'Cualquier servidor con /chat/completions (LM Studio, vLLM, etc.).',
  },
};

/* El límite de tokens por respuesta es la causa número uno de JSON
   truncado: el modelo empieza a escribir, se queda sin presupuesto y el
   objeto queda abierto. Un objeto comercial completo (red team, plan,
   mensajes) ronda los 4.000-6.000 tokens, así que 3.200 garantiza fallos
   intermitentes. generateJson además escala el límite cuando detecta un
   corte por longitud. */
export const DEFAULT_MAX_TOKENS = 8192;
export const HARD_MAX_TOKENS = 16000;

/* Espera al recibir 413/429 por tokens por minuto. La ventana de la cuota
   gratuita de Groq es de un minuto; 20 s suele alcanzar y no deja la misión
   mirando una pantalla fija. */
const RATE_LIMIT_WAIT_MS = 20000;
const MIN_BUDGET_TOKENS = 1024;

function shrinkBudget(budget) {
  return Math.max(MIN_BUDGET_TOKENS, Math.round(budget / 2));
}

export function resolveAIConfig(settings) {
  const ai = settings?.ai || {};
  const provider = (process.env.LUCIAN_AI_PROVIDER || ai.provider || 'openai').toLowerCase();
  const preset = PROVIDERS[provider] || PROVIDERS.custom;
  let baseUrl = process.env.LUCIAN_AI_BASE_URL || ai.baseUrl || preset.baseUrl || '';
  baseUrl = String(baseUrl).trim().replace(/\/+$/, '');
  if (baseUrl.endsWith('/chat/completions')) baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
  if (provider === 'openai' && /^https:\/\/api\.openai\.com$/i.test(baseUrl)) baseUrl = `${baseUrl}/v1`;

  const maxTokens = Number.isFinite(Number(ai.maxTokens)) && Number(ai.maxTokens) > 0
    ? Number(ai.maxTokens)
    : DEFAULT_MAX_TOKENS;

  return {
    provider,
    preset,
    apiKey: String(process.env.LUCIAN_AI_KEY || ai.apiKey || '').trim(),
    baseUrl,
    model: String(process.env.LUCIAN_AI_MODEL || ai.model || preset.model || '').trim(),
    visionModel: String(ai.visionModel || '').trim(),
    temperature: Number(ai.temperature ?? 0.6),
    maxTokens: Math.min(HARD_MAX_TOKENS, Math.max(512, maxTokens)),
  };
}

export function isAIReady(settings) {
  const cfg = resolveAIConfig(settings);
  if (cfg.provider === 'ollama') return Boolean(cfg.baseUrl && cfg.model);
  if (cfg.provider === 'pollinations') return Boolean(cfg.baseUrl && cfg.model);
  if (cfg.provider === 'custom') return Boolean(cfg.baseUrl && cfg.model && (cfg.apiKey || /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(cfg.baseUrl)));
  return Boolean(cfg.apiKey && cfg.baseUrl && cfg.model);
}

function endpoints(cfg) {
  if (cfg.provider === 'anthropic') {
    const root = cfg.baseUrl.replace(/\/+$/, '');
    return {
      chat: root.endsWith('/v1') ? `${root}/messages` : `${root}/v1/messages`,
      models: root.endsWith('/v1') ? `${root}/models` : `${root}/v1/models`,
    };
  }
  return {
    chat: `${cfg.baseUrl}/chat/completions`,
    models: `${cfg.baseUrl}/models`,
  };
}

function baseHeaders(cfg) {
  if (cfg.provider === 'anthropic') {
    return {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
  }
  const headers = { 'content-type': 'application/json' };
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === 'openrouter') {
    headers['http-referer'] = 'http://localhost/lucian';
    headers['x-title'] = 'Lucian';
  }
  return headers;
}

function errorMessage(status, text) {
  let detail = '';
  try {
    const data = JSON.parse(text);
    detail = data?.error?.message || data?.message || data?.error?.type || '';
    if (Array.isArray(data?.error?.details)) detail += ` ${data.error.details.map((d) => d.message || '').join(' ')}`;
  } catch {
    detail = String(text || '').slice(0, 500);
  }
  return `${status} ${detail || 'Error del proveedor'}`.replace(/\s+/g, ' ').trim();
}

/* Groq (y otros proveedores con cuota gratuita por minuto) responden 413
   cuando la petición supera el límite de tokens por minuto de la
   organización. No es "la petición es demasiado grande para siempre": es
   una cuota temporal. Reintentar enseguida con el mismo tamaño vuelve a
   fallar, así que hay que esperar la ventana y achicar el pedido. */
export function isRateLimitError(error) {
  const message = String(error?.message || '');
  const status = Number(message.match(/^(\d{3})/)?.[1] || 0);
  if (status === 429) return true;
  if (/tokens per minute|rate limit|quota/i.test(message)) return true;
  return status === 413 && /request too large/i.test(message);
}

function contentFromOpenAI(data) {
  const message = data?.choices?.[0]?.message;
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((part) => part?.text || part?.content || '').join('\n').trim();
  }
  return '';
}

function contentFromAnthropic(data) {
  if (!Array.isArray(data?.content)) return '';
  return data.content.filter((part) => part?.type === 'text').map((part) => part.text).join('\n').trim();
}

function buildOpenAIMessages({ system, prompt, history, images }) {
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (Array.isArray(history)) {
    for (const item of history.slice(-8)) {
      if (!item?.content) continue;
      messages.push({ role: item.role === 'assistant' ? 'assistant' : 'user', content: String(item.content) });
    }
  }
  if (images?.length) {
    const parts = [{ type: 'text', text: prompt }];
    for (const image of images) {
      const url = image.dataUrl || `data:${image.mime || 'image/jpeg'};base64,${image.base64}`;
      parts.push({ type: 'image_url', image_url: { url } });
    }
    messages.push({ role: 'user', content: parts });
  } else {
    messages.push({ role: 'user', content: prompt });
  }
  return messages;
}

function buildAnthropicContent({ prompt, images }) {
  if (!images?.length) return prompt;
  const content = [];
  for (const image of images) {
    let mime = image.mime || 'image/jpeg';
    let base64 = image.base64 || '';
    if (!base64 && image.dataUrl) {
      const match = String(image.dataUrl).match(/^data:([^;]+);base64,(.+)$/);
      if (match) { mime = match[1]; base64 = match[2]; }
    }
    if (base64) content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: base64 } });
  }
  content.push({ type: 'text', text: prompt });
  return content;
}

async function providerRequest(cfg, body, timeoutMs = 180000) {
  const url = endpoints(cfg).chat;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: baseHeaders(cfg),
    body: JSON.stringify(body),
  }, timeoutMs);
  const text = await response.text();
  if (!response.ok) throw new Error(errorMessage(response.status, text));
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('El proveedor devolvió una respuesta ilegible'); }
  return data;
}

/* ─────────────────────────────────────────────────────────────
   Chat unificado
   ───────────────────────────────────────────────────────────── */

export async function chat(cfg, options = {}) {
  const {
    system = '',
    prompt = '',
    history = [],
    json = false,
    temperature = cfg.temperature ?? 0.6,
    maxTokens = cfg.maxTokens ?? 3200,
    model = cfg.model,
    images = [],
  } = options;

  if (!cfg.baseUrl) throw new Error('Falta la dirección del proveedor de IA');
  if (!model) throw new Error('Falta elegir un modelo de IA');
  if (!cfg.apiKey && !['ollama', 'custom', 'pollinations'].includes(cfg.provider)) throw new Error('Falta la clave de IA');

  const usage = { input: 0, output: 0, total: 0 };
  let lastError = null;

  // Los modelos Claude recientes (Sonnet 4.5/5, Opus 4.1...) rechazan
  // `temperature` con 400 "deprecated". Es un parámetro opcional: nunca
  // lo enviamos a Anthropic y nos ahorramos reintentos innecesarios.
  const skipTemperature = cfg.provider === 'anthropic';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let body;
    if (cfg.provider === 'anthropic') {
      body = {
        model,
        max_tokens: maxTokens,
        ...(skipTemperature ? {} : { temperature }),
        messages: [{ role: 'user', content: buildAnthropicContent({ prompt, images }) }],
      };
      if (system) body.system = system;
      if (Array.isArray(history) && history.length) {
        const prior = history.slice(-8).filter((h) => h?.content).map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: String(h.content),
        }));
        body.messages = [...prior, ...body.messages];
      }
    } else {
      body = {
        model,
        messages: buildOpenAIMessages({ system, prompt, history, images }),
        temperature,
        max_tokens: maxTokens,
      };
      if (json) body.response_format = { type: 'json_object' };
    }

    try {
      let data = await providerRequest(cfg, body);
      const text = cfg.provider === 'anthropic' ? contentFromAnthropic(data) : contentFromOpenAI(data);
      const finishReason = String(cfg.provider === 'anthropic'
        ? (data?.stop_reason || '')
        : (data?.choices?.[0]?.finish_reason || ''));
      const truncated = finishReason === 'length' || finishReason === 'max_tokens';
      const u = data?.usage || {};
      usage.input += Number(u.prompt_tokens ?? u.input_tokens ?? 0) || 0;
      usage.output += Number(u.completion_tokens ?? u.output_tokens ?? 0) || 0;
      usage.total = usage.input + usage.output;
      if (!text) {
        // Claude con "thinking" puede agotar max_tokens sin devolver texto.
        // Duplicamos el presupuesto y reintentamos antes de rendirnos.
        if (truncated && attempt < 4 && maxTokens < 16000) {
          body.max_tokens = Math.min(16000, Math.round(maxTokens * 2));
          continue;
        }
        const error = new Error(`El modelo no devolvió texto (${finishReason || 'vacío'})`);
        error.truncated = truncated;
        error.finishReason = finishReason;
        throw error;
      }
      return { text, usage, model, provider: cfg.provider, finishReason, truncated };
    } catch (error) {
      lastError = error;
      const message = String(error.message || '');
      const status = Number(message.match(/^(\d{3})/)?.[1] || 0);

      // Un corte por límite de tokens no se arregla reintentando con el mismo
      // presupuesto: generateJson es quien escala y vuelve a pedir.
      if (error.truncated) break;

      // Ajustes por diferencias entre proveedores.
      if (status === 400 || status === 422) {
        if (body.response_format) { delete body.response_format; continue; }
        if (body.temperature !== undefined) { delete body.temperature; continue; }
        if (body.max_tokens !== undefined) {
          body.max_completion_tokens = body.max_tokens;
          delete body.max_tokens;
          continue;
        }
      }

      if (status === 429 || (status === 413 && /tokens per minute/i.test(message))) {
        if (attempt < 4) {
          await sleep(46000);
          continue;
        }
      }
      if (status === 500 || status === 502 || status === 503 || status === 529 || !status) {
        if (attempt < 4) {
          await sleep(1800 * (attempt + 1));
          continue;
        }
      }
      break;
    }
  }

  throw new Error(humanError(lastError));
}

export async function transcribeAudio(cfg, audioBuffer, mime = 'audio/ogg') {
  if (!cfg?.baseUrl) throw new Error('Falta la dirección del proveedor de IA');
  const provider = cfg.provider;
  // Solo OpenAI y compatibles exponen /audio/transcriptions.
  if (!['openai', 'openrouter', 'groq', 'custom'].includes(provider)) {
    throw new Error('Tu proveedor no soporta transcripción de audio. Configurá OpenAI, Groq o un servidor compatible.');
  }
  const url = `${cfg.baseUrl}/audio/transcriptions`;
  const form = new FormData();
  const blob = new Blob([audioBuffer], { type: mime || 'audio/ogg' });
  form.append('file', blob, 'audio.ogg');
  form.append('model', provider === 'groq' ? 'whisper-large-v3' : 'whisper-1');
  form.append('language', 'es');
  form.append('response_format', 'text');
  const headers = {};
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
  const response = await fetchWithTimeout(url, { method: 'POST', headers, body: form, timeoutMs: 120000 });
  const text = await response.text();
  if (!response.ok) throw new Error(`Transcripción falló: ${response.status} ${text.slice(0, 200)}`);
  return String(text || '').trim();
}

export async function generateJson(cfg, options = {}) {
  const {
    system = '',
    prompt = '',
    temperature = 0.4,
    maxTokens = cfg.maxTokens ?? DEFAULT_MAX_TOKENS,
    model = cfg.model,
    images = [],
    expects = 'object',
    attempts = 3,
  } = options;

  const contract = [
    system,
    '',
    'FORMATO DE SALIDA:',
    `Respondé únicamente con un ${expects === 'array' ? 'array' : 'objeto'} JSON válido, sin markdown, sin explicaciones antes ni después.`,
    'Usá comillas dobles, sin comentarios, sin comas finales. Todos los textos en español rioplatense neutro salvo que se pida otro idioma.',
    'Sé conciso: máximo 2 frases por campo de texto y máximo 5 elementos por lista, salvo que la tarea pida otro número.',
  ].join('\n');

  const baseMax = Math.min(HARD_MAX_TOKENS, Math.max(512, Number(maxTokens) || DEFAULT_MAX_TOKENS));
  const budgetFor = (attempt) => Math.min(HARD_MAX_TOKENS, Math.max(baseMax, Math.round(baseMax * (2 ** attempt))));

  let extra = '';
  let totalUsage = { input: 0, output: 0, total: 0 };
  let lastRaw = '';
  let lastFinishReason = '';
  let lastError = null;
  let lastBudget = baseMax;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastBudget = budgetFor(attempt);
    let result;
    try {
      result = await chat(cfg, {
        system: contract,
        prompt: `${prompt}${extra}`,
        json: expects !== 'array',
        temperature,
        maxTokens: lastBudget,
        model,
        images: attempt === 0 ? images : [],
      });
    } catch (error) {
      lastError = error;
      if (!error.truncated && isRateLimitError(error)) {
        /* La cuota es por minuto: la petición rebotó por tamaño, no por
           contenido. Se espera la ventana y se pide un JSON más corto, en
           vez de tumbar el paso entero (era la causa de las misiones
           "Mercado y competencia: 413 Request too large" y del plan final). */
        lastBudget = shrinkBudget(lastBudget);
        extra = [
          '',
          '',
          'RESPUESTA MUY LARGA PARA LA CUOTA DEL PROVEEDOR.',
          'Volvé a responder el JSON COMPLETO pero mucho más corto:',
          'máximo 1 frase por campo de texto, máximo 3 elementos por lista y sin repetir el contexto.',
        ].join('\n');
        if (attempt < attempts - 1) {
          await sleep(RATE_LIMIT_WAIT_MS);
          continue;
        }
        break;
      }
      if (!error.truncated) throw error;
      lastError = error;
      lastRaw = '';
      lastFinishReason = error.finishReason || 'length';
      extra = [
        '',
        '',
        'LA RESPUESTA SE CORTÓ POR EL LÃMITE DE TOKENS.',
        'No dejes el JSON abierto. Volvé a responder el JSON COMPLETO, más breve:',
        'máximo 2 frases por campo de texto, máximo 4 elementos por lista y sin repetir el contexto.',
      ].join('\n');
      continue;
    }
    totalUsage = {
      input: totalUsage.input + result.usage.input,
      output: totalUsage.output + result.usage.output,
      total: totalUsage.total + result.usage.total,
    };
    lastRaw = result.text;
    lastFinishReason = result.finishReason || '';
    const truncated = result.finishReason === 'length' || result.finishReason === 'max_tokens';
    if (truncated) {
      extra = [
        '',
        '',
        'LA RESPUESTA ANTERIOR SE CORTÓ POR EL LÃMITE DE TOKENS.',
        'Volvé a responder el JSON COMPLETO, más breve:',
        'máximo 2 frases por campo de texto, máximo 4 elementos por lista y sin repetir el contexto.',
      ].join('\n');
      continue;
    }
    const parsed = extractJson(result.text);
    const validShape = parsed !== null && (expects === 'array' ? Array.isArray(parsed) : typeof parsed === 'object' && !Array.isArray(parsed));
    if (validShape) {
      return {
        data: parsed,
        usage: totalUsage,
        model: result.model,
        raw: result.text,
        attempts: attempt + 1,
        maxTokens: lastBudget,
        finishReason: result.finishReason || '',
      };
    }
    lastError = new Error('El modelo no devolvió JSON válido');
    extra = [
      '',
      '',
      'CORRECCIÓN OBLIGATORIA:',
      'Tu respuesta anterior no fue JSON válido o no respetó la forma pedida.',
      'Volvé a responder SOLO con el JSON completo, empezando con { y terminando con }, y más breve.',
      'Respuesta anterior (recortada):',
      truncate(result.text, 900),
    ].join('\n');
  }

  const truncated = lastFinishReason === 'length' || lastFinishReason === 'max_tokens' || Boolean(lastError?.truncated);
  const throttled = !truncated && isRateLimitError(lastError);
  const error = new Error(truncated
    ? `El modelo cortó la respuesta por el límite de tokens (${baseMax} → ${lastBudget}) y el JSON quedó incompleto después de ${attempts} intentos.`
    : throttled
      ? `El proveedor limitó la petición por tokens por minuto después de ${attempts} intentos. ${String(lastError?.message || '').slice(0, 200)}`
      : `El modelo no devolvió JSON válido después de ${attempts} intentos.`);
  error.raw = lastRaw;
  error.truncated = truncated;
  error.finishReason = lastFinishReason;
  error.attempts = attempts;
  error.lastBudget = lastBudget;
  throw error;
}

/* ─────────────────────────────────────────────────────────────
   Modelos disponibles y prueba de conexión
   ───────────────────────────────────────────────────────────── */

export async function listModels(cfg) {
  if (!cfg.baseUrl) throw new Error('Falta la dirección del proveedor');
  if (!cfg.apiKey && !['ollama', 'custom', 'pollinations'].includes(cfg.provider)) throw new Error('Falta la clave de IA');

  if (cfg.provider === 'gemini') {
    const response = await fetchWithTimeout('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': cfg.apiKey },
    }, 25000);
    const text = await response.text();
    if (!response.ok) throw new Error(errorMessage(response.status, text));
    const data = JSON.parse(text);
    const models = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => ({ id: String(m.name || '').replace(/^models\//, ''), label: m.displayName || String(m.name || '').replace(/^models\//, '') }));
    return models;
  }

  const response = await fetchWithTimeout(endpoints(cfg).models, { headers: baseHeaders(cfg) }, 25000);
  const text = await response.text();
  if (!response.ok) throw new Error(errorMessage(response.status, text));
  const data = JSON.parse(text);
  const raw = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  const blocked = /embed|whisper|tts|dall-e|moderation|audio|rerank|image|vision-preview|clip/i;
  const models = raw
    .map((m) => {
      if (typeof m === 'string') return { id: m, label: m };
      const id = m.id || m.name || m.model;
      return { id: String(id || '').replace(/^models\//, ''), label: m.display_name || m.name || id };
    })
    .filter((m) => m.id && !blocked.test(m.id))
    .filter((m) => !/^(text-|omni-moderation|gpt-3\.5-turbo-instruct)/i.test(m.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  return models;
}

export async function testAI(settings) {
  const cfg = resolveAIConfig(settings);
  if (!cfg.apiKey && !['ollama', 'custom', 'pollinations'].includes(cfg.provider)) throw new Error('Falta la clave de IA');
  const result = await chat(cfg, {
    system: 'Sos un verificador de conexión. Respondé exactamente: OK',
    prompt: 'Probá la conexión respondiendo OK.',
    temperature: 0,
    maxTokens: 12,
  });
  return { reply: result.text.trim().slice(0, 80), model: result.model, provider: result.provider };
}

export function describeProvider(provider) {
  return PROVIDERS[provider] || PROVIDERS.custom;
}
