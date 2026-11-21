import { extractJson } from './util.mjs';

export const ACTION_TYPES = ['buscar', 'crear_borrador', 'actualizar_hilo', 'guardar_aprendizaje', 'agendar_seguimiento', 'enviar_borrador', 'lanzar_mision', 'actualizar_producto', 'cotizar', 'analizar_hilo', 'generar_contenido', 'investigar'];

export const ACTION_SPECS = {
  buscar: {
    auto: true,
    validate(args) {
      const query = String(args?.query || '').trim();
      if (!query) return { ok: false, error: 'Falta query' };
      if (query.length > 300) return { ok: false, error: 'query demasiado larga' };
      const limit = Math.max(1, Math.min(8, Number(args?.limit || 5)));
      return { ok: true, args: { query, limit } };
    },
  },
  crear_borrador: {
    auto: true,
    validate(args) {
      const threadId = String(args?.threadId || '').trim();
      const subject = String(args?.subject || '').trim();
      const body = String(args?.body || '').trim();
      if (!threadId) return { ok: false, error: 'Falta threadId' };
      if (!body) return { ok: false, error: 'Falta body' };
      if (body.length > 5000) return { ok: false, error: 'body demasiado largo' };
      const channel = String(args?.channel || 'email');
      return { ok: true, args: { threadId, subject, body, channel } };
    },
  },
  actualizar_hilo: {
    auto: true,
    validate(args) {
      const threadId = String(args?.threadId || '').trim();
      if (!threadId) return { ok: false, error: 'Falta threadId' };
      const patch = {};
      if (args?.stage !== undefined) patch.stage = String(args.stage).trim();
      if (args?.nextStep !== undefined) patch.nextStep = String(args.nextStep).trim();
      if (args?.notes !== undefined) patch.notes = String(args.notes).trim();
      return { ok: true, args: { threadId, ...patch } };
    },
  },
  guardar_aprendizaje: {
    auto: true,
    validate(args) {
      const insight = String(args?.insight || '').trim();
      if (!insight) return { ok: false, error: 'Falta insight' };
      return {
        ok: true,
        args: {
          insight,
          tag: String(args?.tag || '').trim(),
          confidence: args?.confidence,
          evidence: args?.evidence,
          apply: Boolean(args?.apply),
        },
      };
    },
  },
  agendar_seguimiento: {
    auto: true,
    validate(args) {
      const threadId = String(args?.threadId || '').trim();
      const at = String(args?.at || '').trim();
      if (!threadId) return { ok: false, error: 'Falta threadId' };
      if (!at) return { ok: false, error: 'Falta at' };
      return { ok: true, args: { threadId, at, note: String(args?.note || '').trim() } };
    },
  },
  enviar_borrador: {
    auto: false,
    validate(args) {
      const threadId = String(args?.threadId || '').trim();
      const draftId = String(args?.draftId || '').trim();
      if (!threadId) return { ok: false, error: 'Falta threadId' };
      if (!draftId) return { ok: false, error: 'Falta draftId' };
      return { ok: true, args: { threadId, draftId } };
    },
  },
  lanzar_mision: {
    auto: false,
    validate(args) {
      const productId = String(args?.productId || '').trim();
      if (!productId) return { ok: false, error: 'Falta productId' };
      const markets = Array.isArray(args?.markets) ? args.markets.map(String) : undefined;
      const depth = args?.depth ? String(args.depth) : undefined;
      const name = args?.name ? String(args.name) : undefined;
      return { ok: true, args: { productId, markets, depth, name } };
    },
  },
  cotizar: {
    auto: false,
    validate(args) {
      const threadId = String(args?.threadId || '').trim();
      if (!threadId) return { ok: false, error: 'Falta threadId' };
      const out = { threadId };
      if (args?.quantity !== undefined) out.quantity = Math.max(1, Math.min(100000, Math.floor(Number(args.quantity) || 1)));
      if (args?.unitPrice !== undefined) {
        const price = Number(args.unitPrice);
        if (!Number.isFinite(price) || price < 0) return { ok: false, error: 'unitPrice inválido' };
        out.unitPrice = price;
      }
      if (args?.shipping !== undefined) out.shipping = Math.max(0, Number(args.shipping) || 0);
      if (args?.discount !== undefined) out.discount = Math.max(0, Number(args.discount) || 0);
      if (args?.taxRate !== undefined) out.taxRate = Math.max(0, Math.min(100, Number(args.taxRate) || 0));
      if (args?.notes) out.notes = String(args.notes).slice(0, 2000);
      if (args?.paymentLink) out.paymentLink = String(args.paymentLink).trim();
      if (args?.productId) out.productId = String(args.productId).trim();
      if (args?.approve === true) out.approve = true;
      return { ok: true, args: out };
    },
  },
  analizar_hilo: {
    auto: true,
    validate(args) {
      const threadId = String(args?.threadId || '').trim();
      if (!threadId) return { ok: false, error: 'Falta threadId' };
      return { ok: true, args: { threadId } };
    },
  },
  generar_contenido: {
    auto: true,
    validate(args) {
      const productId = String(args?.productId || '').trim();
      const type = String(args?.type || 'post').trim();
      if (!productId) return { ok: false, error: 'Falta productId' };
      return { ok: true, args: { productId, type, platform: String(args?.platform || '').trim() } };
    },
  },
  investigar: {
    auto: true,
    validate(args) {
      const query = String(args?.query || '').trim();
      if (!query) return { ok: false, error: 'Falta query' };
      const limit = Math.max(1, Math.min(8, Number(args?.limit || 5)));
      return { ok: true, args: { query, limit } };
    },
  },
};

function extractActionBlock(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1];
  const raw = extractJson(text);
  return raw ? JSON.stringify(raw) : null;
}

export function parseAction(text) {
  const source = String(text || '');
  let action = null;
  let cleanText = source;
  try {
    const json = extractJson(source);
    if (json && json.accion) {
      const a = json.accion;
      const tipo = String(a?.tipo || '').trim();
      if (ACTION_SPECS[tipo]) {
        const validation = ACTION_SPECS[tipo].validate(a?.args || {});
        if (validation.ok) {
          action = {
            tipo,
            args: validation.args,
            resumen: String(a?.resumen || '').trim(),
            requiere_accion: a?.requiere_accion === true,
          };
          // remove the json block from text
          const fencedMatch = source.match(/```json\s*[\s\S]*?```/i);
          if (fencedMatch) cleanText = source.replace(fencedMatch[0], '').trim();
          else {
            // remove first json object
            const idx = source.indexOf('{');
            const last = source.lastIndexOf('}');
            if (idx !== -1 && last > idx) cleanText = (source.slice(0, idx) + source.slice(last + 1)).trim();
          }
        }
      }
    }
  } catch { /* ignore */ }
  if (!action || action.requiere_accion !== true) {
    // if requiere_accion false, ignore block
    if (action && action.requiere_accion !== true) action = null;
  }
  return { action, cleanText };
}

export function describeAction(action) {
  if (!action) return '';
  return action.resumen || `${action.tipo}(${JSON.stringify(action.args || {})})`;
}

export async function executeAction({ action, store, actions = {}, chatId, search }) {
  if (!action || !ACTION_SPECS[action.tipo]) {
    return { ok: false, message: 'No reconozco esa acción; puedo investigar, buscar, crear_borrador, actualizar_hilo, guardar_aprendizaje, agendar_seguimiento, enviar_borrador, lanzar_mision, actualizar_producto, cotizar, analizar_hilo, generar_contenido.' };
  }
  const spec = ACTION_SPECS[action.tipo];
  const v = spec.validate(action.args || {});
  if (!v.ok) return { ok: false, message: `Acción inválida: ${v.error}` };
  const args = v.args;
  try {
    if (action.tipo === 'buscar') {
      const searchFn = search || (async (s, q, o) => {
        const { searchWebDetailed } = await import('./search.mjs');
        return searchWebDetailed(s, q, o);
      });
      const settings = store.settings();
      const detail = await searchFn(settings, args.query, { count: args.limit, strict: false });
      const results = (detail.results || []).slice(0, args.limit);
      if (!results.length) {
        return { ok: false, message: `No encontré resultados para "${args.query}". ${detail.errors?.[0] || ''}`.trim() };
      }
      const lines = results.map((r, i) => `${i + 1}. ${r.title} - ${r.url}`).join('\n');
      return { ok: true, message: `Resultados para "${args.query}" (${detail.engine || 'web'}):\n${lines}` };
    }
    if (action.tipo === 'crear_borrador') {
      const thread = store.find('threads', args.threadId);
      if (!thread) return { ok: false, message: 'No encontré el hilo.' };
      const draft = {
        id: `dr_${Date.now()}`,
        subject: args.subject || '',
        body: args.body,
        status: 'revisar',
        source: 'telegram',
        channel: args.channel || 'email',
        language: 'es',
        guardVersion: 2,
        createdAt: new Date().toISOString(),
      };
      thread.drafts = thread.drafts || [];
      thread.drafts.unshift(draft);
      await store.patch('threads', thread.id, { drafts: thread.drafts });
      return { ok: true, message: `Borrador creado para ${thread.contact?.company || args.threadId} (en revisión).` };
    }
    if (action.tipo === 'actualizar_hilo') {
      const thread = store.find('threads', args.threadId);
      if (!thread) return { ok: false, message: 'No encontré el hilo.' };
      const patch = {};
      if (args.stage) patch.stage = args.stage;
      if (args.nextStep) patch.nextStep = args.nextStep;
      if (args.notes) patch.notes = args.notes;
      // Marcar ganado desde Telegram también arranca el reloj de postventa.
      if (args.stage === 'ganado' && !thread.postSaleAt) patch.postSaleAt = new Date().toISOString();
      await store.patch('threads', thread.id, patch);
      return { ok: true, message: `Hilo ${thread.contact?.company || args.threadId} actualizado.` };
    }
    if (action.tipo === 'guardar_aprendizaje') {
      await store.insert('learnings', {
        id: `lr_${Date.now()}`,
        insight: args.insight,
        tag: args.tag || '',
        confidence: args.confidence,
        evidence: args.evidence,
        apply: args.apply,
        at: new Date().toISOString(),
      });
      return { ok: true, message: 'Aprendizaje guardado.' };
    }
    if (action.tipo === 'agendar_seguimiento') {
      const thread = store.find('threads', args.threadId);
      if (!thread) return { ok: false, message: 'No encontré el hilo.' };
      await store.patch('threads', thread.id, { nextFollowUp: args.at, followUpNote: args.note });
      return { ok: true, message: `Seguimiento agendado para ${thread.contact?.company || args.threadId}.` };
    }
    if (action.tipo === 'enviar_borrador') {
      if (!actions.sendThreadMessage) return { ok: false, message: 'No puedo enviar borradores desde aquí.' };
      const provider = String(store.settings()?.email?.provider || 'manual');
      if (!['resend', 'gmail', 'webhook'].includes(provider)) {
        return {
          ok: false,
          message: 'No envié el correo. El proveedor está en modo manual o sin configurar. Elegí y probá Resend, Gmail o webhook en Ajustes. No lo marcaré como enviado.',
        };
      }
      const res = await actions.sendThreadMessage(args.threadId, {
        draftId: args.draftId,
        channel: provider,
        confirm: true,
      });
      const sent = res?.message;
      if (!sent || sent.status !== 'enviado' || sent.channel !== provider) {
        return { ok: false, message: 'El proveedor no confirmó el envío. Revisá la bandeja; no asumiré que salió.' };
      }
      return {
        ok: true,
        message: `Correo realmente enviado mediante ${provider} a ${res?.thread?.contact?.company || 'el destinatario'} (registro: ${sent.id || 'sin ID'}).`,
      };
    }
    if (action.tipo === 'lanzar_mision') {
      if (!actions.createMission) return { ok: false, message: 'No puedo lanzar misiones desde aquí.' };
      const res = await actions.createMission({ productId: args.productId, markets: args.markets, depth: args.depth, name: args.name });
      return { ok: true, message: `Misión lanzada: ${res?.name || res?.id || 'ok'}.` };
    }
    if (action.tipo === 'actualizar_producto') {
      const product = store.find('products', args.productId);
      if (!product) return { ok: false, message: 'No encontré el producto.' };
      const patch = {};
      if (args.price !== undefined) patch.price = args.price;
      if (args.cost !== undefined) patch.cost = args.cost;
      if (args.status !== undefined) patch.status = args.status;
      await store.patch('products', product.id, patch);
      return { ok: true, message: `Producto ${product.name} actualizado.` };
    }
    if (action.tipo === 'cotizar') {
      if (!actions.createQuote) return { ok: false, message: 'No puedo cotizar desde aquí.' };
      const res = await actions.createQuote(args.threadId, {
        quantity: args.quantity,
        unitPrice: args.unitPrice,
        shipping: args.shipping,
        discount: args.discount,
        taxRate: args.taxRate,
        notes: args.notes,
        paymentLink: args.paymentLink,
        productId: args.productId,
        approve: args.approve === true,
      });
      return { ok: true, message: `Cotización ${res?.quote?.number || ''} preparada para ${res?.thread?.contact?.company || args.threadId}. Total: ${res?.quote?.total}.` };
    }
    if (action.tipo === 'analizar_hilo') {
      if (!actions.analyzeThread) return { ok: false, message: 'No puedo analizar hilos desde aquí.' };
      const thread = store.find('threads', args.threadId);
      if (!thread) return { ok: false, message: 'No encontré el hilo.' };
      const res = await actions.analyzeThread({ thread, store, apply: true });
      return { ok: true, message: `Análisis: score ${res?.analysis?.score ?? res?.score ?? '-'}, etapa ${res?.analysis?.etapa || '-'}. ${res?.analysis?.siguiente_paso || ''}`.trim() };
    }
    if (action.tipo === 'investigar') {
      const searchFn = search || (async (s, q, o) => {
        const { searchWebDetailed } = await import('./search.mjs');
        return searchWebDetailed(s, q, o);
      });
      const settings = store.settings();
      const detail = await searchFn(settings, args.query, { count: args.limit, strict: false });
      const results = (detail.results || []).slice(0, args.limit);
      if (!results.length) return { ok: false, message: `No encontré resultados para "${args.query}". ${detail.errors?.[0] || ''}`.trim() };
      const lines = results.map((r, i) => `${i + 1}. ${r.title} - ${r.url}`).join('\n');
      return { ok: true, message: `Investigación sobre "${args.query}" (${detail.engine || 'web'}):\n${lines}` };
    }
    if (action.tipo === 'generar_contenido') {
      const product = store.find('products', args.productId);
      if (!product) return { ok: false, message: 'No encontré el producto.' };
      const item = {
        id: `cnt_${Date.now()}`,
        productId: product.id,
        type: args.type || 'post',
        platform: args.platform || '',
        title: `${product.name} · ${args.type || 'post'}`,
        status: 'idea',
        createdAt: new Date().toISOString(),
      };
      await store.insert('content', item);
      return { ok: true, message: `Idea de contenido creada para ${product.name} (${item.type}).` };
    }
    return { ok: false, message: 'Acción no implementada.' };
  } catch (error) {
    return { ok: false, message: `La ejecución falló: ${error.message}.` };
  }
}