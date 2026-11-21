import { assessCommercialMessage } from './commercial-quality.mjs';
import fs from 'node:fs/promises';
import {
  asArray, asNumber, asObject, asString, clamp, cleanWebsite, humanError, normalizeDomain, nowISO,
  sleep, sniffImage, truncate, uid, uniqueBy,
} from './util.mjs';
import { chat, generateJson, isAIReady, resolveAIConfig } from './ai.mjs';
import { resolveAIWithFallback, recordAiFailure, recordAiSuccess } from './connections.mjs';
import { searchMany } from './search.mjs';
import { enrichProspect, GENERIC_NAME_TOKENS, normalizeText, verifyWebsite } from './hunter.mjs';
import { candidatesForMarkets } from './directory.mjs';
import { DEPTHS, STEPS, askPrompt, getAgent, replyPrompt, systemFor } from './prompts.mjs';
import { demoAsk, demoReply, demoStep } from './demo.mjs';
import {
  emailDomain, isDemoEmail, isValidEmail, isSharedEmailDomain, isSuppressed, normalizeEmail,
} from './email.mjs';

/* ─────────────────────────────────────────────────────────────
   Concurrencia: dos llamadas de IA a la vez como máximo.
   ───────────────────────────────────────────────────────────── */

function createSemaphore(max) {
  let active = 0;
  const queue = [];
  return async function run(task) {
    if (active >= max) {
      await new Promise((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      const next = queue.shift();
      if (next) next();
    }
  };
}

const aiGate = createSemaphore(2);
const running = new Set();

function missionDelay(ms) {
  const raw = process.env.LUCIAN_MOCK_DELAY;
  if (raw !== undefined) return Math.max(0, Number(raw) || 0);
  return ms;
}

/* ─────────────────────────────────────────────────────────────
   Persistencia y eventos
   ───────────────────────────────────────────────────────────── */

function persist(store, mission) {
  mission.updatedAt = nowISO();
  store.setDebounced('missions', store.get('missions'), 400).catch(() => {});
}

function persistLog(store, mission) {
  mission.updatedAt = nowISO();
  store.setDebounced('missions', store.get('missions'), 1500).catch(() => {});
}

function publicMission(mission) {
  return mission;
}

function emitMission(broadcast, mission) {
  broadcast?.(mission.id, { type: 'mission', mission: publicMission(mission), at: nowISO() });
}

function emitStep(broadcast, mission, step) {
  broadcast?.(mission.id, {
    type: 'step',
    missionId: mission.id,
    step,
    artifact: mission.artifacts?.[step.id] || null,
    progress: mission.progress || 0,
    status: mission.status,
    at: nowISO(),
  });
}

async function logMission(store, broadcast, mission, text, type = 'info') {
  const entry = { at: nowISO(), text: String(text).slice(0, 500), type };
  mission.log = [...(mission.log || []), entry].slice(-180);
  persistLog(store, mission);
  broadcast?.(mission.id, { type: 'log', missionId: mission.id, log: entry, at: entry.at });
  return entry;
}

function pipelineFor(mission) {
  const depth = DEPTHS[mission.depth] || DEPTHS.estandar;
  return depth.steps;
}

function phaseFor(stepId) {
  if (['brief', 'research', 'customs', 'pricing'].includes(stepId)) return 'investigacion';
  if (['prospecting', 'enrichment'].includes(stepId)) return 'prospeccion';
  if (['outreach', 'content'].includes(stepId)) return 'mensajes';
  if (['compliance', 'redteam', 'revision'].includes(stepId)) return 'revision';
  return 'cierre';
}

/* ─────────────────────────────────────────────────────────────
   Búsqueda por paso
   ───────────────────────────────────────────────────────────── */

/* Ciudad de referencia por mercado: buscar "tiendas de iluminación en
   Madrid" encuentra comercios reales; "en España" devuelve guías y
   comparadores. */
const MARKET_CITIES = {
  espana: ['Madrid', 'Barcelona'],
  mexico: ['Ciudad de México', 'Guadalajara'],
  'estados unidos': ['New York', 'Miami'],
  argentina: ['Buenos Aires', 'Córdoba'],
  chile: ['Santiago'],
  brasil: ['São Paulo'],
  colombia: ['Bogotá'],
  uruguay: ['Montevideo'],
  peru: ['Lima'],
  'reino unido': ['London'],
  francia: ['Paris'],
  alemania: ['Berlin'],
  italia: ['Milán'],
  portugal: ['Lisboa'],
  canada: ['Toronto'],
  australia: ['Sydney'],
  'costa rica': ['San José'],
  ecuador: ['Quito'],
  paraguay: ['Asunción'],
  bolivia: ['La Paz'],
  venezuela: ['Caracas'],
  panama: ['Ciudad de Panamá'],
  'republica dominicana': ['Santo Domingo'],
  guatemala: ['Ciudad de Guatemala'],
  'el salvador': ['San Salvador'],
  honduras: ['Tegucigalpa'],
  nicaragua: ['Managua'],
  cuba: ['La Habana'],
  suiza: ['Zúrich'],
  'paises bajos': ['Ãmsterdam'],
  belgica: ['Bruselas'],
  austria: ['Viena'],
  suecia: ['Estocolmo'],
  noruega: ['Oslo'],
  dinamarca: ['Copenhague'],
  finlandia: ['Helsinki'],
  irlanda: ['Dublín'],
  japon: ['Tokio'],
  china: ['Shanghái'],
  india: ['Mumbai'],
  'emiratos arabes unidos': ['Dubái'],
  sudafrica: ['Ciudad del Cabo'],
};

function citiesForMarkets(markets = []) {
  const out = [];
  for (const market of markets) {
    const key = normalizeText(market);
    const cities = MARKET_CITIES[key] || [String(market || '')];
    for (const city of cities) {
      if (city && !out.includes(city)) out.push(city);
    }
  }
  return out;
}

function queriesFor(stepId, ctx) {
  const product = ctx.product || {};
  const mission = ctx.mission || {};
  const settings = ctx.settings || {};
  const year = new Date().getFullYear();
  const name = product.name || 'lámpara de diseño';
  const category = product.category || 'iluminación de diseño';
  const markets = (mission.markets?.length ? mission.markets : settings.mission?.markets || ['España', 'México', 'Estados Unidos']).slice(0, 3);
  const first = markets[0] || 'España';
  const cities = citiesForMarkets(markets);

  if (stepId === 'research') {
    return [
      `lámparas de diseño ${cities[0] || first} precio tiendas`,
      `designer lighting trends ${year} handmade small series`,
      `tiendas de iluminación de diseño ${cities[0] || first}`,
      `${category} wholesale buyers ${cities[1] || first}`,
    ];
  }
  if (stepId === 'customs') {
    return [
      ...markets.map((market) => `import duty lighting fixtures HS 9405 ${market} ${year}`),
      `CE certification decorative lighting RoHS requirements ${year}`,
    ].slice(0, 5);
  }
  if (stepId === 'prospecting') {
    const primary = cities[0] || first;
    const secondary = cities[1] || cities[0] || first;
    return [
      `tiendas de iluminación y lámparas ${primary}`,
      `lámparas de diseño ${secondary}`,
      `showroom iluminación ${secondary}`,
      `tiendas de diseño e interiorismo ${primary}`,
      `design lighting stores ${cities[2] || secondary}`,
    ].slice(0, 5);
  }
  return [];
}

async function gatherSearch(stepId, ctx, deps) {
  const def = STEPS[stepId];
  if (!def?.search) return null;
  const queries = queriesFor(stepId, ctx);
  if (!queries.length) return null;
  const settings = ctx.settings;
  const pages = settings.mission?.researchPages === false ? 0 : (def.pages || 0);
  await logMission(deps.store, deps.broadcast, ctx.mission, `${getAgent(def.agent).name}: buscando en ${queries.length} consultas.`);
  const bundle = await searchMany(settings, queries, {
    perQuery: stepId === 'prospecting' ? 6 : 5,
    pages,
    // La prospección es el paso que decide si hay ventas: se queda con más
    // intentos. Investigación y aduanas pueden trabajar con menos fuentes.
    searchAttempts: stepId === 'prospecting' ? 6 : stepId === 'research' ? 3 : 2,
    searchBudgetMs: stepId === 'prospecting' ? 100000 : stepId === 'research' ? 50000 : 35000,
    strict: stepId === 'prospecting',
    searchDepth: stepId === 'prospecting' ? (settings?.search?.prospectingDepth || 'advanced') : 'basic',
    onProgress: ({ query, found, engine }) => {
      const detail = engine ? ` vía ${engine}` : '';
      logMission(deps.store, deps.broadcast, ctx.mission, `Fuente: “${truncate(query, 80)}” → ${found} resultados${detail}.`, 'search').catch(() => {});
    },
  });
  ctx.searchErrors = bundle.errors || [];
  ctx.searchEngines = bundle.engines || [];
  if (bundle.errors.length) {
    await logMission(deps.store, deps.broadcast, ctx.mission, `Búsqueda parcial: ${bundle.errors.length} intento(s) fallaron. ${bundle.results.length ? 'Sigo con lo disponible.' : 'No hay fuentes para trabajar.'} ${truncate(bundle.errors[0] || '', 180)}`, 'warn');
  }
  if (!bundle.results.length) {
    await logMission(deps.store, deps.broadcast, ctx.mission, 'Sin resultados de búsqueda. El agente va a trabajar con supuestos explícitos y solo podrá proponer compradores que se puedan verificar por su sitio web.', 'warn');
  }
  return bundle;
}

/* ─────────────────────────────────────────────────────────────
   Normalización de lo que devuelve el modelo
   ───────────────────────────────────────────────────────────── */

export function normalizeArtifact(stepId, input, ctx = {}) {
  const data = asObject(input);
  const arr = (key) => asArray(data[key]).filter((v) => v !== null && v !== undefined);

  if (stepId === 'brief') {
    return {
      ...data,
      tesis: asString(data.tesis),
      propuesta_de_valor: asString(data.propuesta_de_valor),
      publico_primario: asString(data.publico_primario),
      publicos_secundarios: arr('publicos_secundarios').map(String),
      paises: arr('paises').map((p) => ({ ...asObject(p), pais: asString(p?.pais), motivo: asString(p?.motivo), canal: asString(p?.canal), dificultad: asString(p?.dificultad, 'media') })),
      angulos: arr('angulos').map((a) => ({ ...asObject(a), angulo: asString(a?.angulo), prueba: asString(a?.prueba), uso: asString(a?.uso, 'ambos') })),
      riesgos: arr('riesgos').map(String),
      supuestos: arr('supuestos').map(String),
      preguntas_abiertas: arr('preguntas_abiertas').map(String),
      criterio_de_exito: asString(data.criterio_de_exito),
    };
  }
  if (stepId === 'research') {
    const searchUrls = new Set((ctx?.search?.results || []).map((r) => String(r?.url || '').trim()).filter(Boolean));
    const knownHosts = new Set();
    for (const u of searchUrls) { try { knownHosts.add(new URL(u).hostname); } catch { /* noop */ } }
    const fuenteVerificada = (fuente) => {
      const u = String(fuente || '').trim();
      if (!u) return false;
      if (searchUrls.has(u)) return true;
      try { return knownHosts.has(new URL(u).hostname); } catch { return false; }
    };
    return {
      ...data,
      panorama: asString(data.panorama),
      tendencias: arr('tendencias').map((t) => {
        const fuente = asString(t?.fuente);
        return { ...asObject(t), tendencia: asString(t?.tendencia), evidencia: asString(t?.evidencia), fuente, fuente_verificada: fuenteVerificada(fuente) };
      }),
      competidores: arr('competidores').map((c) => {
        const fuente = asString(c?.fuente || c?.url);
        const base = { ...asObject(c), nombre: asString(c?.nombre), pais: asString(c?.pais), precio: asString(c?.precio), canal: asString(c?.canal), fortaleza: asString(c?.fortaleza), hueco: asString(c?.hueco), fuente };
        const fields = [base.precio, base.canal, base.fortaleza, base.hueco, base.fuente];
        const hasReal = fields.some((v) => {
          const s = String(v || '').trim().toLowerCase();
          return s && s !== 'sin dato' && s !== 'sin datos' && s !== 'n/a' && s !== '-';
        });
        return hasReal ? { ...base, fuente_verificada: fuenteVerificada(fuente) } : null;
      }).filter(Boolean),
      demanda: { ...asObject(data.demanda), senales: asArray(data.demanda?.senales).map(String), temporadas: asString(data.demanda?.temporadas), terminos: asArray(data.demanda?.terminos).map(String) },
      canales: arr('canales').map((c) => ({ ...asObject(c), canal: asString(c?.canal), por_que: asString(c?.por_que), esfuerzo: asString(c?.esfuerzo, 'medio') })),
      fuentes: arr('fuentes').map((f) => ({ ...asObject(f), titulo: asString(f?.titulo || f?.title), url: asString(f?.url) })).filter((f) => f.url),
      conclusion: asString(data.conclusion),
    };
  }
  if (stepId === 'customs') {
    const searchUrls = new Set((ctx?.search?.results || []).map((r) => String(r?.url || '').trim()).filter(Boolean));
    const searchPages = new Set((ctx?.search?.pages || []).map((p) => String(p?.url || '').trim()).filter(Boolean));
    const knownUrls = new Set([...searchUrls, ...searchPages]);
    const fuenteVerificada = (fuente) => {
      const u = String(fuente || '').trim();
      if (!u) return false;
      if (knownUrls.has(u)) return true;
      // coincidencia por dominio
      try {
        const host = new URL(u).hostname;
        for (const known of knownUrls) {
          try { if (new URL(known).hostname === host) return true; } catch { /* noop */ }
        }
      } catch { /* noop */ }
      return false;
    };
    return {
      ...data,
      resumen: asString(data.resumen),
      paises: arr('paises').map((p) => {
        const fuente = asString(p?.fuente);
        const verificada = fuenteVerificada(fuente);
        return {
          ...asObject(p),
          pais: asString(p?.pais), codigo_hs: asString(p?.codigo_hs), arancel_estimado: asString(p?.arancel_estimado),
          impuestos: asString(p?.impuestos), requisitos: asArray(p?.requisitos).map(String),
          etiquetado: asString(p?.etiquetado), certificaciones: asArray(p?.certificaciones).map(String),
          incoterm: asString(p?.incoterm), courier: asString(p?.courier), riesgo: asString(p?.riesgo, 'medio'),
          notas: asString(p?.notas), fuente,
          fuente_verificada: verificada,
          estado_fuente: verificada ? 'confirmado' : 'no_verificado',
        };
      }),
      documentos: arr('documentos').map(String),
      advertencia: asString(data.advertencia),
    };
  }
  if (stepId === 'pricing') {
    const costos = Object.fromEntries(Object.entries(asObject(data.costos)).map(([k, v]) => [k, asNumber(v)]));
    const costoBase = Object.values(costos).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
    const escenarios = arr('escenarios').map((e) => {
      const canal = asString(e?.canal);
      const precio = asNumber(e?.precio);
      const comisionPct = asNumber(e?.comision_pct);
      const envio = asNumber(e?.envio);
      const comision = precio * (comisionPct / 100);
      const gananciaCalculada = precio - costoBase - envio - comision;
      const margenCalculado = precio > 0 ? (gananciaCalculada / precio) * 100 : 0;
      return {
        ...asObject(e),
        canal,
        precio,
        comision_pct: comisionPct,
        envio,
        ganancia: Number.isFinite(gananciaCalculada) ? Math.round(gananciaCalculada * 100) / 100 : asNumber(e?.ganancia),
        margen_pct: Number.isFinite(margenCalculado) ? Math.round(margenCalculado * 10) / 10 : asNumber(e?.margen_pct),
        notas: asString(e?.notas),
        calculo_automatico: true,
      };
    });
    const landedCost = arr('landed_cost').map((l) => {
      const obj = asObject(l);
      const hasComp = ['flete', 'seguro', 'aranceles', 'otros'].some((k) => obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '');
      const flete = hasComp ? asNumber(l?.flete) : 0;
      const seguro = hasComp ? asNumber(l?.seguro) : 0;
      const aranceles = hasComp ? asNumber(l?.aranceles) : 0;
      const otros = hasComp ? asNumber(l?.otros) : 0;
      let costoPuesto;
      let estado;
      if (hasComp) {
        costoPuesto = costoBase + flete + seguro + aranceles + otros;
        estado = 'calculado';
      } else if (l?.costo_puesto_destino !== undefined && l?.costo_puesto_destino !== null && String(l.costo_puesto_destino).trim() !== '') {
        costoPuesto = asNumber(l.costo_puesto_destino);
        estado = 'no_verificado';
      } else {
        const costoPais = asNumber(l?.costo);
        costoPuesto = costoBase + costoPais;
        estado = 'no_verificado';
      }
      return {
        ...obj,
        pais: asString(l?.pais),
        flete: hasComp ? flete : asNumber(l?.costo),
        seguro,
        aranceles,
        otros,
        costo_base: costoBase,
        costo_puesto_destino: Math.round(costoPuesto * 100) / 100,
        supuestos: asString(l?.supuestos),
        estado,
        calculo_automatico: estado === 'calculado',
      };
    });
    return {
      ...data,
      moneda: asString(data.moneda, 'USD'),
      supuestos: arr('supuestos').map(String),
      costos,
      costo_base_total: Math.round(costoBase * 100) / 100,
      escenarios,
      psicologia: asString(data.psicologia),
      descuentos: arr('descuentos').map((d) => ({ ...asObject(d), tipo: asString(d?.tipo), condicion: asString(d?.condicion), limite: asString(d?.limite) })),
      landed_cost: landedCost,
      recomendacion: asString(data.recomendacion),
      advertencia: asString(data.advertencia),
    };
  }
  if (stepId === 'prospecting') {
    return {
      ...data,
      segmentos: arr('segmentos').map((s) => ({ ...asObject(s), segmento: asString(s?.segmento), por_que: asString(s?.por_que), donde_buscar: asArray(s?.donde_buscar).map(String), volumen: asString(s?.volumen, 'medio') })),
      compradores: arr('compradores').filter((b) => b && (b.nombre || b.empresa)).map((b) => ({
        nombre: asString(b.nombre || b.empresa),
        tipo: asString(b.tipo, 'tienda'), pais: asString(b.pais),
        ciudad: asString(b.ciudad), web: normalizeProspectUrl(b.web || b.website), contacto: asString(b.contacto),
        rol: asString(b.rol), email: asString(b.email).toLowerCase().trim(),
        email_estado: asString(b.email_estado, 'desconocido'), por_que: asString(b.por_que),
        angulo: asString(b.angulo), prioridad: asString(b.prioridad, 'media'),
        origen: ['fuentes', 'conocimiento'].includes(asString(b.origen)) ? asString(b.origen) : 'fuentes',
        fuente: normalizeProspectUrl(b.fuente),
      })),
      canales: arr('canales').map((c) => ({ ...asObject(c), canal: asString(c?.canal), como: asString(c?.como), esfuerzo: asString(c?.esfuerzo, 'medio'), retorno: asString(c?.retorno, 'medio') })),
      proximos_pasos: arr('proximos_pasos').map(String),
      faltantes: arr('faltantes').map(String),
      descartados: [],
      verificacion: null,
    };
  }
  if (stepId === 'outreach') {
    return {
      ...data,
      estrategia: asString(data.estrategia),
      secuencia: arr('secuencia').map((s, index) => ({ ...asObject(s), paso: asNumber(s?.paso, index + 1), dia: asNumber(s?.dia, index * 4), objetivo: asString(s?.objetivo), asunto: asString(s?.asunto), cuerpo: asString(s?.cuerpo) })),
      mensajes: arr('mensajes').map((m) => ({ ...asObject(m), comprador: asString(m?.comprador), pais: asString(m?.pais), idioma: asString(m?.idioma, 'es'), asunto: asString(m?.asunto), cuerpo: asString(m?.cuerpo), personalizacion: asString(m?.personalizacion), cta: asString(m?.cta) })).filter((m) => m.cuerpo),
      whatsapp: arr('whatsapp').map((w) => ({ ...asObject(w), comprador: asString(w?.comprador), mensaje: asString(w?.mensaje) })),
      objeciones: arr('objeciones').map((o) => ({ ...asObject(o), objecion: asString(o?.objecion), respuesta: asString(o?.respuesta) })),
      firma: asString(data.firma),
      reglas: arr('reglas').map(String),
    };
  }
  if (stepId === 'content') {
    return {
      ...data,
      pilares: arr('pilares').map((p) => ({ ...asObject(p), pilar: asString(p?.pilar), idea: asString(p?.idea) })),
      calendario: arr('calendario').map((c, index) => ({
        ...asObject(c), dia: asString(c?.dia, `Día ${index + 1}`), plataforma: asString(c?.plataforma), formato: asString(c?.formato),
        gancho: asString(c?.gancho), guion: asString(c?.guion), caption: asString(c?.caption),
        hashtags: asArray(c?.hashtags).map((h) => String(h).startsWith('#') ? String(h) : `#${h}`), cta: asString(c?.cta),
      })),
      ganchos: arr('ganchos').map(String),
      serie: { ...asObject(data.serie), nombre: asString(data.serie?.nombre), descripcion: asString(data.serie?.descripcion), episodios: asArray(data.serie?.episodios).map(String) },
      fotos: arr('fotos').map((f) => ({ ...asObject(f), toma: asString(f?.toma), por_que: asString(f?.por_que) })),
      advertencia: asString(data.advertencia),
    };
  }
  if (stepId === 'compliance') {
    return {
      ...data,
      veredicto: asString(data.veredicto, 'con_cambios'),
      riesgos: arr('riesgos').map((r) => ({ ...asObject(r), nivel: asString(r?.nivel, 'medio'), tema: asString(r?.tema), detalle: asString(r?.detalle), arreglo: asString(r?.arreglo) })),
      claims_a_evitar: arr('claims_a_evitar').map(String),
      email: { ...asObject(data.email), base_legal: asString(data.email?.base_legal), opt_out: asString(data.email?.opt_out), datos_personales: asString(data.email?.datos_personales) },
      aduanas: arr('aduanas').map(String),
      correcciones: arr('correcciones').map((c) => ({ ...asObject(c), original: asString(c?.original), sugerido: asString(c?.sugerido) })),
      checklist: arr('checklist').map((c) => ({ ...asObject(c), item: asString(c?.item), ok: Boolean(c?.ok) })),
    };
  }
  if (stepId === 'redteam') {
    return {
      ...data,
      veredicto: asString(data.veredicto, 'ajustar'),
      supuestos_fragiles: arr('supuestos_fragiles').map((s) => ({ ...asObject(s), supuesto: asString(s?.supuesto), por_que_falla: asString(s?.por_que_falla), prueba_barata: asString(s?.prueba_barata) })),
      agujeros: arr('agujeros').map((a) => ({ ...asObject(a), area: asString(a?.area), problema: asString(a?.problema), impacto: asString(a?.impacto, 'medio'), arreglo: asString(a?.arreglo) })),
      preguntas_dificiles: arr('preguntas_dificiles').map(String),
      escenarios: arr('escenarios').map((e) => ({ ...asObject(e), escenario: asString(e?.escenario), probabilidad: asString(e?.probabilidad, 'media'), plan_b: asString(e?.plan_b) })),
      lo_que_sobra: arr('lo_que_sobra').map(String),
      sello: asString(data.sello),
    };
  }
  if (stepId === 'revision') {
    return {
      ...data,
      cambios: arr('cambios').map((c) => ({ ...asObject(c), que: asString(c?.que), por_que: asString(c?.por_que) })),
      mensajes: arr('mensajes').map((m) => ({ ...asObject(m), comprador: asString(m?.comprador), asunto: asString(m?.asunto), cuerpo: asString(m?.cuerpo) })),
      ajustes_plan: arr('ajustes_plan').map(String),
      riesgos_que_quedan: arr('riesgos_que_quedan').map(String),
    };
  }
  if (stepId === 'synthesis') {
    return {
      ...data,
      decision: asString(data.decision),
      tesis: asString(data.tesis),
      plan_7_dias: arr('plan_7_dias').map((d, index) => ({ ...asObject(d), dia: asNumber(d?.dia, index + 1), accion: asString(d?.accion), resultado: asString(d?.resultado), tiempo: asString(d?.tiempo) })),
      prioridades: arr('prioridades').map((p, index) => ({ ...asObject(p), prioridad: asNumber(p?.prioridad, index + 1), accion: asString(p?.accion), por_que: asString(p?.por_que), metrica: asString(p?.metrica) })),
      mensajes_listos: arr('mensajes_listos').map((m) => ({ ...asObject(m), comprador: asString(m?.comprador), asunto: asString(m?.asunto), cuerpo: asString(m?.cuerpo) })),
      presupuesto: { ...asObject(data.presupuesto), inversion: asNumber(data.presupuesto?.inversion), detalle: asString(data.presupuesto?.detalle), retorno_esperado: asString(data.presupuesto?.retorno_esperado) },
      metricas: arr('metricas').map((m) => ({ ...asObject(m), metrica: asString(m?.metrica), meta: asString(m?.meta), cuando: asString(m?.cuando) })),
      no_hacer: arr('no_hacer').map(String),
      resumen: asString(data.resumen),
    };
  }
  if (stepId === 'learning') {
    return {
      ...data,
      aprendizajes: arr('aprendizajes').map((a) => ({ ...asObject(a), insight: asString(a?.insight), evidencia: asString(a?.evidencia), confianza: asString(a?.confianza, 'media'), aplicar: asString(a?.aplicar), etiqueta: asString(a?.etiqueta, 'operacion') })).filter((a) => a.insight),
    };
  }
  return data;
}

function summarizeStep(stepId, data) {
  const d = data || {};
  let text = '';
  if (stepId === 'brief') text = d.tesis || d.propuesta_de_valor;
  else if (stepId === 'research') text = d.conclusion || d.panorama;
  else if (stepId === 'customs') text = d.resumen;
  else if (stepId === 'pricing') text = d.recomendacion;
  else if (stepId === 'prospecting') {
    const verification = d.verificacion || {};
    const candidates = verification.candidatos ?? (d.compradores || []).length;
    const verified = verification.verificados ?? (d.compradores || []).length;
    const discarded = verification.descartados ?? (d.descartados || []).length;
    const searchErrors = d.busqueda?.errores || [];
    text = `${verified} compradores verificados de ${candidates} candidatos. ${(d.segmentos || []).length} segmentos priorizados.`;
    if (discarded) text += ` ${discarded} candidatos descartados por no ser verificables.`;
    if (!verified && searchErrors.length) text += ` La búsqueda web falló: ${searchErrors[0]}`;
  }
  else if (stepId === 'enrichment') text = `${d.encontrados || 0} emails públicos de ${d.revisados || 0} compradores${d.descartados_email ? `; ${d.descartados_email} emails descartados por no estar publicados` : ''}.`;
  else if (stepId === 'outreach') text = `${(d.mensajes || []).length} mensajes personalizados y una secuencia de ${(d.secuencia || []).length} pasos.`;
  else if (stepId === 'content') text = `${(d.calendario || []).length} piezas de contenido propuestas.`;
  else if (stepId === 'compliance') text = `Veredicto: ${d.veredicto || 'sin veredicto'}. ${(d.riesgos || []).length} riesgos detectados.`;
  else if (stepId === 'redteam') text = `Veredicto: ${d.veredicto || 'sin veredicto'}. ${d.sello || ''}`;
  else if (stepId === 'revision') text = `${(d.cambios || []).length} correcciones aplicadas al plan.`;
  else if (stepId === 'synthesis') text = d.decision || d.resumen;
  else if (stepId === 'learning') text = `${(d.aprendizajes || []).length} aprendizajes guardados.`;
  return truncate(String(text || 'Paso completado.'), 260);
}

/* ─────────────────────────────────────────────────────────────
   Verificación de compradores.

   Un nombre en el JSON no es un comprador. Antes de crear un hilo se
   comprueba que el sitio exista y hable de esa tienda, o que la fuente
   citada la mencione. Lo que no se puede comprobar se descarta con el
   motivo a la vista: es preferible una lista corta y real que una
   bandeja con fantasmas.
   ───────────────────────────────────────────────────────────── */

const AGGREGATOR_DOMAINS = /(^|\.)(idealo|amazon|ebay|etsy|alibaba|aliexpress|mercadolibre|mercadolivre|houzz|archdaily|dezeen|designboom|pinterest|instagram|facebook|linkedin|youtube|tiktok|twitter|x|wikipedia|google|bing|duckduckgo|yelp|tripadvisor|booking|airbnb|foursquare|paginasamarillas|yellowpages|tiendeo|carrefour|ikea|leroymerlin|elcorteingles|walmart|homedepot|target)\.[a-z.]+$/i;

/* Marcas y cadenas que no le compran a un maker: fabricantes que venden su
   propia línea y grandes superficies. El modelo las propone por prestigio,
   pero un mensaje de venta ahí es tiempo perdido. */
const NOT_BUYER_DOMAINS = /(^|\.)(vibia|marset|santacole|artemide|flos|foscarini|lzf|lzf-lamps|louis-poulsen|louispoulsen|fritzhansen|muuto|normann|normann-copenhagen|hay|andtradition|verpan|bocci|moooi|tomdixon|anglepoise|nanimarquina|luxcambra|faro|eglo|sargadelos|kavehome|maisonsdumonde|leroymerlin|bricomart|bricodepot|conforama|jysk|homecenter|sodimac|easy|walmart|target|homedepot|westelm|potterybarn|rh|ikea)\.[a-z.]+$/i;

const GENERIC_BUYER_NAMES = /^(tienda|tienda de diseno|tienda de diseno independiente|tienda de concepto|concept store|estudio|estudio de interiorismo|galeria|galeria de diseno|museo tienda|hotel|hotel boutique|marketplace|marketplace de comparacion|distribuidor|distribuidor de diseno|showroom|comprador|interiorista|mayorista)( \d+)?$/;

function stripAccents(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function isPlaceholderBuyerName(name) {
  const normalized = stripAccents(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!normalized) return true;
  if (/ejemplo generico|sin nombre verificable|prospecto generico|sin dato/.test(normalized)) return true;
  if (/marketplace de comparacion|comparador de precios/.test(normalized)) return true;
  return GENERIC_BUYER_NAMES.test(normalized);
}

export function isAggregatorSite(value) {
  const domain = normalizeDomain(value);
  if (!domain) return false;
  return AGGREGATOR_DOMAINS.test(domain);
}

export function isNotBuyerSite(value) {
  const domain = normalizeDomain(value);
  if (!domain) return false;
  return NOT_BUYER_DOMAINS.test(domain);
}

export function normalizeProspectUrl(value) {
  const raw = asString(value).trim();
  if (!raw) return '';
  if (/^(sin dato|sin datos|desconocido|no disponible|n\/?a|ninguno|ninguna|-|””)$/i.test(raw)) return '';
  if (!/^https?:\/\//i.test(raw)) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(raw)) return cleanWebsite(`https://${raw}`);
    return '';
  }
  return cleanWebsite(raw);
}

function sourceRecords(search) {
  const byUrl = new Map();
  for (const result of asArray(search?.results)) {
    if (!result?.url) continue;
    byUrl.set(result.url, {
      url: result.url,
      title: asString(result.title),
      snippet: asString(result.snippet),
      content: '',
    });
  }
  for (const page of asArray(search?.pages)) {
    if (!page?.url) continue;
    const previous = byUrl.get(page.url) || { url: page.url, title: '', snippet: '', content: '' };
    byUrl.set(page.url, {
      ...previous,
      title: previous.title || asString(page.title),
      content: asString(page.content),
    });
  }
  return [...byUrl.values()];
}

function buyerMentionTokens(name) {
  return [...new Set(stripAccents(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !GENERIC_NAME_TOKENS.has(token)))];
}

function sourceMentionsBuyer(records, buyer) {
  const tokens = buyerMentionTokens(buyer?.nombre);
  const preferred = normalizeProspectUrl(buyer?.fuente);
  const ordered = preferred
    ? [...records.filter((record) => record.url === preferred), ...records.filter((record) => record.url !== preferred)]
    : records;
  if (tokens.length) {
    const distinctive = tokens.sort((a, b) => b.length - a.length)[0];
    for (const record of ordered) {
      const haystack = stripAccents(`${record.title} ${record.snippet} ${record.content}`).replace(/\s+/g, ' ');
      if (distinctive && haystack.includes(distinctive)) return record;
    }
    return null;
  }
  // Si el nombre solo tiene palabras genéricas ("The IQ Home"), solo vale una
  // coincidencia del nombre completo y sin espacios: "home" aparece en todas
  // partes y no prueba nada.
  const squashedName = stripAccents(buyer?.nombre).replace(/[^a-z0-9]+/g, '');
  if (squashedName.length < 5) return null;
  for (const record of ordered) {
    const haystack = stripAccents(`${record.title} ${record.snippet} ${record.content}`).replace(/[^a-z0-9]+/g, '');
    if (haystack.includes(squashedName)) return record;
  }
  return null;
}

async function mapLimit(items, limit, task) {
  const list = asArray(items);
  const results = new Array(list.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, list.length)) }, async () => {
    while (next < list.length) {
      const index = next;
      next += 1;
      results[index] = await task(list[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function verifyProspectArtifact(output, ctx, deps) {
  const artifact = asObject(output);
  const candidates = asArray(artifact.compradores);
  const records = sourceRecords(ctx?.search);
  const limit = clamp(Number(ctx?.mission?.maxProspects) || 12, 1, 40);
  const accepted = [];
  const discarded = [];
  const seenNames = new Set();
  const seenDomains = new Set();

  /* Refuerzo de directorio: tiendas reales conocidas para los mercados de la
     misión. No se agregan a ciegas: pasan por la misma verificación de sitio
     y nombre que cualquier candidato del modelo. */
  const directory = candidatesForMarkets(ctx?.mission?.markets || []);
  const knownNames = new Set(candidates.map((buyer) => stripAccents(buyer?.nombre).replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean));
  const knownDomains = new Set(candidates.map((buyer) => normalizeDomain(normalizeProspectUrl(buyer?.web))).filter(Boolean));
  const extra = directory.filter((buyer) => {
    const name = stripAccents(buyer.nombre).replace(/[^a-z0-9]+/g, ' ').trim();
    const domain = normalizeDomain(buyer.web);
    return !knownNames.has(name) && !knownDomains.has(domain);
  });
  if (extra.length) {
    candidates.push(...extra);
    if (deps?.store && deps?.broadcast) {
      await logMission(deps.store, deps.broadcast, ctx.mission, `Directorio local: ${extra.length} tienda(s) reales de estos mercados se suman a la verificación.`, 'search').catch(() => {});
    }
  }

  const checks = await mapLimit(candidates.slice(0, 60), 4, async (buyer) => {
    const name = asString(buyer?.nombre).trim();
    if (isPlaceholderBuyerName(name)) {
      return { ok: false, buyer, motivo: 'Nombre genérico o de ejemplo: no corresponde a una tienda real.' };
    }
    const web = normalizeProspectUrl(buyer?.web);
    if (web && isAggregatorSite(web)) {
      return { ok: false, buyer, motivo: 'El sitio es un agregador o marketplace, no una tienda que compre a marcas.' };
    }
    if (web && isNotBuyerSite(web)) {
      return { ok: false, buyer, motivo: 'El sitio es de una marca/fabricante o gran cadena: no compra a un maker.' };
    }
    const source = sourceMentionsBuyer(records, buyer);
    if (web) {
      const check = await verifyWebsite(web, name);
      if (check.ok && check.status === 'verificado') {
        return {
          ok: true,
          buyer: {
            ...buyer,
            web,
            web_estado: 'verificado',
            web_titulo: check.title,
            web_url: check.url || web,
            fuente_verificada: source?.url || '',
            verificado: true,
            verificado_at: nowISO(),
          },
        };
      }
      if (check.ok && check.status === 'fuente_secundaria') {
        if (source) {
          return {
            ok: true,
            buyer: {
              ...buyer,
              web: '',
              web_estado: 'fuente_secundaria',
              web_titulo: check.title,
              fuente: source.url,
              fuente_verificada: source.url,
              verificado: true,
              verificado_at: nowISO(),
              verificacion_nota: check.reason,
            },
          };
        }
        return { ok: false, buyer, motivo: check.reason || 'La página menciona la tienda pero no es su sitio oficial.' };
      }
      if (source) {
        return {
          ok: true,
          buyer: {
            ...buyer,
            web: '',
            web_estado: 'fuente_secundaria',
            web_titulo: '',
            fuente: source.url,
            fuente_verificada: source.url,
            verificado: true,
            verificado_at: nowISO(),
            verificacion_nota: check.reason || 'El sitio no confirmó la tienda; se usa la fuente citada.',
          },
        };
      }
      return { ok: false, buyer, motivo: check.reason || `El sitio ${web} no responde o no menciona la tienda.` };
    }
    if (source) {
      return {
        ok: true,
        buyer: {
          ...buyer,
          web_estado: 'fuente_secundaria',
          web_titulo: '',
          fuente: source.url,
          fuente_verificada: source.url,
          verificado: true,
          verificado_at: nowISO(),
        },
      };
    }
    return { ok: false, buyer, motivo: 'Sin sitio web comprobable ni fuente que mencione la tienda.' };
  });

  for (const check of checks) {
    const buyer = check.buyer || {};
    if (!check.ok) {
      discarded.push({
        nombre: asString(buyer.nombre),
        web: normalizeProspectUrl(buyer.web),
        motivo: check.motivo,
      });
      continue;
    }
    if (accepted.length >= limit) {
      discarded.push({ nombre: asString(buyer.nombre), web: buyer.web || '', motivo: `Excede el límite de ${limit} compradores.` });
      continue;
    }
    const nameKey = stripAccents(buyer.nombre).replace(/[^a-z0-9]+/g, ' ').trim();
    const domain = buyer.web ? normalizeDomain(buyer.web) : '';
    if ((nameKey && seenNames.has(nameKey)) || (domain && seenDomains.has(domain))) {
      discarded.push({ nombre: asString(buyer.nombre), web: buyer.web || '', motivo: 'Comprador repetido en la misma lista.' });
      continue;
    }
    if (nameKey) seenNames.add(nameKey);
    if (domain) seenDomains.add(domain);
    accepted.push(buyer);
  }

  artifact.compradores = accepted;
  artifact.descartados = discarded;
  artifact.verificacion = {
    candidatos: candidates.length,
    verificados: accepted.length,
    con_sitio: accepted.filter((buyer) => buyer.web_estado === 'verificado').length,
    fuente_secundaria: accepted.filter((buyer) => buyer.web_estado === 'fuente_secundaria').length,
    directorio: accepted.filter((buyer) => buyer.origen === 'directorio').length,
    descartados: discarded.length,
    at: nowISO(),
  };

  const log = deps?.store && deps?.broadcast
    ? (text, level) => logMission(deps.store, deps.broadcast, ctx.mission, text, level).catch(() => {})
    : () => {};
  await log(`Verificación: ${accepted.length} de ${candidates.length} compradores confirmados; ${discarded.length} descartados por no ser verificables.`, accepted.length ? 'done' : 'warn');
  if (!accepted.length && candidates.length) {
    await log(`Se descartaron todos los candidatos. Motivos: ${discarded.slice(0, 3).map((item) => `${item.nombre || 'sin nombre'}: ${item.motivo}`).join(' · ')}`, 'warn');
  }
  return artifact;
}

/* Migración de hilos creados antes de la verificación obligatoria.
   No borra nada: marca lo que no se puede sostener y saca de la bandeja
   activa los nombres genéricos que el modelo inventó en versiones previas. */
export async function sanitizeLegacyThreads(store) {
  const threads = store.get('threads') || [];
  let changed = 0;
  let discarded = 0;
  for (const thread of threads) {
    if (!thread || thread.demo) continue;
    if (thread.verification?.webEstado) continue;
    if (thread.unverified && thread.unverifiedMigrated) continue;
    const email = normalizeEmail(thread.contact?.email);
    const website = normalizeProspectUrl(thread.contact?.website);
    const hasContact = isValidEmail(email) || Boolean(website);
    const name = thread.contact?.company || thread.contact?.name || '';
    const invalidBuyer = Boolean(website) && (isAggregatorSite(website) || isNotBuyerSite(website));
    if ((!hasContact && isPlaceholderBuyerName(name)) || invalidBuyer) {
      thread.unverified = true;
      thread.unverifiedMigrated = true;
      thread.unverifiedReason = invalidBuyer
        ? 'Se creó antes de la verificación obligatoria: la web es un agregador, marca o gran cadena, no un comprador.'
        : 'Se creó antes de la verificación obligatoria: era un nombre genérico sin sitio ni email reales.';
      if (!['ganado', 'negociando'].includes(thread.stage)) thread.stage = 'perdido';
      thread.nextStep = 'Hilo descartado: no hay una tienda compradora verificable. No contactar.';
      for (const draft of Array.isArray(thread.drafts) ? thread.drafts : []) {
        if (draft.status === 'enviado') continue;
        draft.status = 'descartado';
        draft.discardedAt = nowISO();
        draft.discardReason = 'Prospecto no verificable (migración de honestidad).';
        discarded += 1;
      }
      thread.updatedAt = nowISO();
      changed += 1;
    } else if (!hasContact && !thread.unverified) {
      thread.unverified = true;
      thread.unverifiedMigrated = true;
      thread.unverifiedReason = 'Sin email ni sitio verificable. Confirmá la tienda y el canal antes de contactarla.';
      for (const draft of Array.isArray(thread.drafts) ? thread.drafts : []) {
        if (draft.status !== 'listo') continue;
        draft.status = 'revisar';
        draft.reviewNote = 'Sin verificación de sitio o email: confirmá que la tienda existe y el canal antes de enviar.';
      }
      thread.updatedAt = nowISO();
      changed += 1;
    }
  }
  if (changed) {
    await store.set('threads', threads);
    await store.activity('system', `Verificación de hilos históricos: ${changed} conversación(es) marcada(s) sin verificar${discarded ? `; ${discarded} borrador(es) descartado(s)` : ''}.`, { changed, discarded });
  }
  return { changed, discarded };
}

async function buildVisionImages(store, product, cfg) {
  if (!cfg.visionModel) return [];
  const photos = (product?.photos || []).filter((photo) => /\.(jpe?g|png|webp)$/i.test(photo.file || '')).slice(0, 2);
  const images = [];
  for (const photo of photos) {
    const file = store.mediaPath(photo.file);
    if (!file) continue;
    try {
      const buffer = await fs.readFile(file);
      if (buffer.length > 4 * 1024 * 1024) continue;
      const kind = sniffImage(buffer);
      if (!kind) continue;
      images.push({ dataUrl: `data:${kind.mime};base64,${buffer.toString('base64')}`, mime: kind.mime });
    } catch { /* seguimos sin imagen */ }
  }
  return images;
}

/* ─────────────────────────────────────────────────────────────
   Enriquecimiento de contactos (herramienta, sin IA)
   ───────────────────────────────────────────────────────────── */

async function runEnrichment(ctx, deps) {
  const buyers = ctx.artifacts?.prospecting?.compradores || [];
  const limit = Math.min(buyers.length, Number(ctx.mission.maxProspects) || 12);
  const selected = buyers.slice(0, limit);
  let found = 0;
  let verified = 0;
  let discardedEmails = 0;
  const detail = [];

  await logMission(deps.store, deps.broadcast, ctx.mission, `Verificando contactos de ${selected.length} compradores. No se inventan direcciones.`);

  const batchSize = 4;
  for (let i = 0; i < selected.length; i += batchSize) {
    const batch = selected.slice(i, i + batchSize);
    await Promise.all(batch.map(async (buyer) => {
      try {
        const update = await enrichProspect(buyer, ctx.settings);
        Object.assign(buyer, update);
        if (update.email) {
          found += 1;
          if (['verificado', 'publico'].includes(update.email_estado)) verified += 1;
          await logMission(deps.store, deps.broadcast, ctx.mission, `Contacto público encontrado: ${buyer.nombre}${update.email ? '' : ''}.`, 'search');
        } else if (update.email_estado === 'descartado_no_verificado') {
          discardedEmails += 1;
          await logMission(deps.store, deps.broadcast, ctx.mission, `Email descartado para ${buyer.nombre}: ${update.email_aviso || 'no se pudo verificar en el sitio.'}`, 'warn');
        } else {
          await logMission(deps.store, deps.broadcast, ctx.mission, `Sin email público: ${buyer.nombre}. Queda para formulario o LinkedIn.`, 'search');
        }
        detail.push({
          comprador: buyer.nombre,
          email: update.email || '',
          estado: update.email_estado || 'sin contacto',
          web: buyer.web || '',
          web_estado: buyer.web_estado || '',
          nota: update.email_fuente ? `Fuente: ${update.email_fuente}` : (update.email_aviso || 'Sin dirección pública verificable.'),
        });
      } catch (error) {
        detail.push({ comprador: buyer.nombre, email: '', estado: 'error', nota: truncate(error.message, 160) });
      }
    }));
  }

  return {
    revisados: selected.length,
    encontrados: found,
    verificados: verified,
    sin_contacto: selected.length - found,
    descartados_email: discardedEmails,
    metodo: ctx.settings.hunter?.apiKey && ctx.settings.hunter?.enabled
      ? 'Sitios públicos + Hunter (dominio y verificación).'
      : 'Sitios públicos (página de inicio y contacto). Hunter no está configurado.',
    detalle: detail,
  };
}

/* ─────────────────────────────────────────────────────────────
   Ejecución de un paso
   ───────────────────────────────────────────────────────────── */

async function executeStep(stepId, ctx, deps) {
  const def = STEPS[stepId];
  const mission = ctx.mission;

  if (stepId === 'enrichment') {
    return runEnrichment(ctx, deps);
  }

  if (mission.demo) {
    await sleep(missionDelay(650 + Math.random() * 700));
    return normalizeArtifact(stepId, demoStep(stepId, ctx), ctx);
  }

  ctx.search = await gatherSearch(stepId, ctx, deps);

  const cfg = ctx.cfg;
  let images = [];
  if (stepId === 'content') {
    images = await buildVisionImages(deps.store, ctx.product, cfg);
    if (images.length) {
      await logMission(deps.store, deps.broadcast, mission, `Director de Contenido: mirando ${images.length} foto(s) del producto.`);
    }
  }

  const prompt = def.prompt(ctx);
  const run = () => aiGate(() => generateJson(cfg, {
    system: systemFor(def.agent),
    prompt,
    temperature: def.temperature ?? 0.45,
    maxTokens: cfg.maxTokens,
    model: images.length ? (cfg.visionModel || cfg.model) : cfg.model,
    images,
    expects: 'object',
    attempts: ['compliance', 'redteam', 'synthesis', 'outreach'].includes(stepId) ? 4 : 3,
    fallback: ctx.fallback || null,
  }));

  let result;
  try {
    result = await run();
  } catch (error) {
    if (images.length) {
      await logMission(deps.store, deps.broadcast, mission, 'No se pudieron usar las fotos con este modelo. Reintentando solo con texto.', 'warn');
      images = [];
      result = await aiGate(() => generateJson(cfg, {
        system: systemFor(def.agent),
        prompt,
        temperature: def.temperature ?? 0.45,
        maxTokens: cfg.maxTokens,
        model: cfg.model,
        expects: 'object',
        attempts: 3,
        fallback: ctx.fallback || null,
      }));
    } else {
      recordAiFailure(error);
      throw error;
    }
  }

  recordAiSuccess();
  const output = normalizeArtifact(stepId, result.data, ctx);
  if (ctx.search?.results?.length) {
    const consulted = uniqueBy(ctx.search.results.map((r) => ({ titulo: r.title || '', url: r.url })), (r) => r.url).slice(0, 10);
    output.fuentes_consultadas = consulted;
  }
  if (ctx.search) {
    output.busqueda = {
      motores: asArray(ctx.search.engines).slice(0, 3),
      resultados: asArray(ctx.search.results).length,
      errores: asArray(ctx.search.errors).slice(0, 4),
    };
  }
  if (stepId === 'prospecting') {
    await verifyProspectArtifact(output, ctx, deps);
  }
  deps.usage.push({ stepId, tokens: result.usage?.total || 0 });
  return output;
}

/* ─────────────────────────────────────────────────────────────
   Creación de hilos, contenido y aprendizajes
   ───────────────────────────────────────────────────────────── */

function normalizeName(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/* Devuelve el mensaje SOLO si pertenece a este comprador. Si hay ambigüedad,
   devuelve null: es preferible no tener borrador antes que mandar el mensaje
   de otra tienda. */
function pickMessage(messages, buyer) {
  const list = (messages || []).filter((m) => m && normalizeName(m.comprador));
  const targets = [buyer?.nombre, buyer?.contacto].map(normalizeName).filter((t) => t.length >= 3);
  if (!targets.length) return null;
  const exact = list.filter((m) => targets.includes(normalizeName(m.comprador)));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const fuzzy = list.filter((m) => {
    const source = normalizeName(m.comprador);
    return targets.some((t) => (t.length >= 5 && source.includes(t)) || (source.length >= 5 && t.includes(source)));
  });
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

const SOURCE_PRIORITY = { outreach: 1, synthesis: 2, revision: 3 };
const MESSAGE_FIELDS = ['asunto', 'cuerpo', 'idioma', 'cta', 'personalizacion'];

function cleanMessage(message, source) {
  const cuerpo = asString(message?.cuerpo);
  return {
    comprador: asString(message?.comprador),
    asunto: asString(message?.asunto),
    cuerpo,
    idioma: asString(message?.idioma),
    cta: asString(message?.cta),
    personalizacion: asString(message?.personalizacion),
    _source: source,
    _bodySource: cuerpo ? source : null,
  };
}

/* Prioridad: revisión post red team > síntesis > outreach original.
   La revisión solo reescribe los mensajes que cambian, así que se fusiona
   por nombre de comprador. Un campo vacío NUNCA pisa un mensaje bueno. */
function mergeMessages({ outreach, synthesis, revision }) {
  const merged = [];
  const index = new Map();
  const add = (message, source) => {
    if (!message || !normalizeName(message.comprador)) return;
    const next = cleanMessage(message, source);
    const key = normalizeName(next.comprador);
    const found = index.get(key);
    if (found === undefined) {
      index.set(key, merged.length);
      merged.push(next);
      return;
    }
    const previous = merged[found];
    const out = { ...previous };
    for (const field of MESSAGE_FIELDS) {
      if (next[field]) out[field] = next[field];
    }
    if (next._bodySource && (!out._bodySource || SOURCE_PRIORITY[next._bodySource] >= SOURCE_PRIORITY[out._bodySource])) {
      out._bodySource = next._bodySource;
    }
    if (SOURCE_PRIORITY[next._source] > SOURCE_PRIORITY[out._source]) out._source = next._source;
    merged[found] = out;
  };
  for (const message of outreach || []) add(message, 'outreach');
  for (const message of synthesis || []) add(message, 'synthesis');
  for (const message of revision || []) add(message, 'revision');
  return merged;
}

/* Solo las correcciones que el guardián marcó como del mensaje se aplican
   al texto. Las de contenido no deben bloquear un correo que no las contiene. */
function isMessageCorrection(correction) {
  const campo = asString(correction?.campo).toLowerCase();
  return !campo || campo === 'mensaje' || campo === 'outreach' || campo === 'ambos';
}

function applyComplianceCorrections(message, corrections) {
  let subject = String(message?.asunto || '');
  let body = String(message?.cuerpo || '');
  let applied = 0;
  for (const correction of corrections || []) {
    if (!isMessageCorrection(correction)) continue;
    const original = String(correction?.original || '').trim();
    const suggested = String(correction?.sugerido || '').trim();
    if (!original || !suggested) continue;
    if (body.includes(original)) {
      body = body.split(original).join(suggested);
      applied += 1;
    }
    if (subject.includes(original)) {
      subject = subject.split(original).join(suggested);
      applied += 1;
    }
  }
  return { asunto: subject, cuerpo: body, applied };
}

function messageMentionsBuyer(message, buyer) {
  const haystack = normalizeName(`${message?.asunto || ''} ${message?.cuerpo || ''}`);
  const names = [buyer?.nombre, buyer?.contacto].map(normalizeName).filter((name) => name.length >= 3);
  return names.some((name) => haystack.includes(name));
}

function requiredReviewMissing(mission) {
  const stepIds = new Set((mission.steps || []).map((step) => step.id));
  return (
    (stepIds.has('compliance') && !mission.artifacts?.compliance)
    || (stepIds.has('redteam') && !mission.artifacts?.redteam)
    || (mission.depth === 'profunda' && !mission.artifacts?.revision)
  );
}

function textCorpus(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textCorpus).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(textCorpus).join('\n');
  return '';
}

function missionMessageState(mission) {
  const complianceVerdict = mission.artifacts?.compliance?.veredicto || '';
  const redteamVerdict = mission.artifacts?.redteam?.veredicto || '';
  const messages = mergeMessages({
    outreach: mission.artifacts?.outreach?.mensajes,
    synthesis: mission.artifacts?.synthesis?.mensajes_listos,
    revision: mission.artifacts?.revision?.mensajes,
  });
  const corrections = mission.artifacts?.compliance?.correcciones || [];
  const messageCorrections = corrections
    .filter(isMessageCorrection)
    .filter((correction) => String(correction?.original || '').trim());
  const corpus = messages.map((message) => `${message.asunto || ''}\n${message.cuerpo || ''}`).join('\n');
  const contentCorpus = textCorpus(mission.artifacts?.content || {});
  const locatedInMessages = messageCorrections.filter((correction) => corpus.includes(String(correction.original).trim())).length;
  const locatedInContent = messageCorrections.filter((correction) => contentCorpus.includes(String(correction.original).trim())).length;
  return {
    messages,
    corpus,
    corrections,
    messageCorrections,
    complianceVerdict,
    redteamVerdict,
    missingReview: requiredReviewMissing(mission),
    // Si cumplimiento pidió cambios de mensaje pero ninguno coincide con el
    // texto real (ni de mensajes ni de contenido), no se puede afirmar que el
    // correo esté corregido.
    complianceUnresolved: complianceVerdict === 'con_cambios'
      && messageCorrections.length > 0
      && locatedInMessages === 0
      && locatedInContent === 0,
    complianceUnlocated: Math.max(0, messageCorrections.length - locatedInMessages - locatedInContent),
    // Un rechazo de cumplimiento es un bloqueo duro (riesgo legal). Un
    // "detener" del red team es una advertencia fuerte: el dueño puede
    // corregir el plan o asumir el riesgo aprobando el borrador a mano.
    blocked: complianceVerdict === 'rechazado',
    blockedReason: complianceVerdict === 'rechazado' ? 'Cumplimiento rechazó el paquete comercial.' : '',
    redteamStop: redteamVerdict === 'detener',
    redteamReason: redteamVerdict === 'detener'
      ? 'El red team pidió detener la misión. Revisá sus objeciones antes de enviar: si asumís el riesgo, aprobá el borrador; si no, corregí el plan y reintentá.'
      : '',
  };
}

function draftPlanForBuyer({ mission, product, buyer, state, reviewDirectory = false }) {
  const source = pickMessage(state.messages, buyer);
  const corrected = applyComplianceCorrections(source, state.corrections);
  const subject = String(corrected.asunto || '').trim();
  const body = String(corrected.cuerpo || '').trim();
  const mentionsBuyer = body ? messageMentionsBuyer({ asunto: subject, cuerpo: body }, buyer) : false;
  let status = 'listo';
  let reviewNote = '';
  let blockedReason = '';
  let reviewKind = '';

  if (!body) {
    status = 'revisar';
    reviewKind = 'sin-mensaje';
    reviewNote = 'No hay un mensaje 1:1 para este comprador. Escribilo a mano; no se reutiliza el de otra tienda.';
  } else if (state.blocked) {
    status = 'bloqueado';
    reviewKind = 'cumplimiento';
    blockedReason = state.blockedReason;
  } else if (state.missingReview) {
    status = 'revisar';
    reviewKind = 'revision-faltante';
    reviewNote = 'Falta la revisión de cumplimiento o red team. Revisá el borrador antes de enviarlo.';
  } else if (state.redteamStop) {
    status = 'revisar';
    reviewKind = 'redteam';
    reviewNote = state.redteamReason || 'El red team pidió detener la misión. Revisá el paso de red team antes de enviar.';
  } else if (state.complianceUnresolved) {
    status = 'revisar';
    reviewKind = 'cumplimiento';
    reviewNote = `Cumplimiento pidió ${state.messageCorrections.length} cambio${state.messageCorrections.length === 1 ? '' : 's'} pero no coinciden con el texto de los mensajes. Revisá el paso de cumplimiento y corregí a mano.`;
  } else if (!mentionsBuyer) {
    status = 'revisar';
    reviewKind = 'nombre';
    reviewNote = 'El mensaje no menciona el nombre del comprador. Verificá que sea para esta tienda antes de enviarlo.';
  } else if (buyer.origen === 'conocimiento') {
    status = 'revisar';
    reviewKind = 'conocimiento';
    reviewNote = 'Comprador propuesto por el modelo y verificado por su sitio web. Confirmá que sea una tienda multimarca (no una marca propia) antes de enviarlo.';
  } else if (buyer.origen === 'directorio' && reviewDirectory) {
    status = 'revisar';
    reviewKind = 'directorio';
    reviewNote = 'Comprador del directorio semilla: confirmá que sea una tienda multimarca y que compre a un maker antes de enviarlo.';
  }

  // La IA puede redactar con cortesía y aun así no ofrecer nada evaluable.
  // Este guardián no envía: obliga a revisar antes de aprobar el mensaje.
  const commercialQuality = assessCommercialMessage({ subject, body, product, buyer });
  if (mission.commercialQualityReview === true && commercialQuality.reviewRequired && status === 'listo') {
    status = 'revisar';
    reviewKind = 'calidad-comercial';
    reviewNote = commercialQuality.reasons.map((reason) => reason.text).join(' ').slice(0, 600)
      || 'Incluí una propuesta comercial verificable.';
  }

  if (mission.manualReviewOnly && status === 'listo') {
    status = 'revisar';
    reviewKind = 'operacion-supervisada';
    reviewNote = 'Esta misión exige revisar al comprador y aprobar expresamente el borrador antes de enviar.';
  }

  return {
    subject: subject || `${product.name}: una serie corta`,
    body,
    language: source?.idioma || 'es',
    status,
    reviewNote,
    reviewKind,
    blockedReason,
    complianceCorrections: corrected.applied,
    compliancePending: state.complianceUnresolved ? state.messageCorrections.length : 0,
    revisionApplied: source?._bodySource === 'revision',
    sourceLayer: source?._source || null,
    mentionsBuyer,
    commercialQuality,
  };
}

function nextStepFor(plan, hasEmail, buyer = {}) {
  if (!plan.body) return 'Escribir el mensaje a mano: no hay un borrador 1:1 para este comprador.';
  if (plan.status === 'bloqueado') return 'No contactar: el borrador está bloqueado por cumplimiento o red team.';
  if (plan.status === 'revisar') return plan.reviewNote || 'Revisá el borrador antes de enviarlo.';
  if (hasEmail) return 'Revisar el borrador y enviarlo.';
  if (buyer?.web_estado === 'fuente_secundaria' || !buyer?.web) {
    return 'Buscar el sitio o el formulario de la tienda, contactar por ese canal y marcar el borrador como enviado. No hay email público verificado.';
  }
  return 'Enviar por formulario o LinkedIn y marcarlo como enviado.';
}

function makeDraft(plan, hasEmail, now) {
  return {
    id: uid('drf'),
    channel: hasEmail ? 'email' : 'formulario',
    language: plan.language,
    subject: plan.subject,
    body: plan.body,
    status: plan.status,
    createdAt: now,
    source: 'mision',
    reviewNote: plan.reviewNote || undefined,
    reviewKind: plan.reviewKind || undefined,
    blockedReason: plan.status === 'bloqueado' ? plan.blockedReason : undefined,
    complianceCorrections: plan.complianceCorrections || undefined,
    compliancePending: plan.compliancePending || undefined,
    revisionApplied: plan.revisionApplied || undefined,
    commercialQuality: plan.commercialQuality || undefined,
    guardVersion: 2,
  };
}

function makeThread({ mission, product, buyer, email, hasEmail, company, plan, now }) {
  const priorityScore = buyer.prioridad === 'alta' ? 78 : buyer.prioridad === 'baja' ? 42 : 60;
  const emailStatus = hasEmail
    ? (['publico', 'verificado', 'probable'].includes(buyer.email_estado) ? buyer.email_estado : 'publico')
    : 'desconocido';
  return {
    id: uid('thr'),
    demo: Boolean(mission.demo),
    missionId: mission.id,
    productId: product.id,
    contact: {
      name: buyer.contacto || buyer.rol || 'Equipo de compras',
      company,
      role: buyer.rol || '',
      email: hasEmail ? email : '',
      emailStatus,
      country: buyer.pais || '',
      city: buyer.ciudad || '',
      website: normalizeProspectUrl(buyer.web),
      type: buyer.tipo || 'tienda',
    },
    verification: {
      webEstado: buyer.web_estado || '',
      webTitulo: buyer.web_titulo || '',
      webUrl: buyer.web_url || normalizeProspectUrl(buyer.web),
      emailEstado: emailStatus,
      emailFuente: buyer.email_fuente || '',
      origen: buyer.origen || '',
      fuente: buyer.fuente_verificada || buyer.fuente || '',
      at: now,
    },
    unverified: false,
    stage: 'nuevo',
    score: clamp(priorityScore + (hasEmail ? 8 : 0), 0, 100),
    source: `Misión ${mission.name}`,
    notes: buyer.por_que || '',
    drafts: plan.body ? [makeDraft(plan, hasEmail, now)] : [],
    messages: [],
    nextStep: nextStepFor(plan, hasEmail, buyer),
    nextFollowUp: null,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function findThreadForBuyer(threads, missionId, buyer, email) {
  const targetEmail = normalizeEmail(email);
  const targetCompany = normalizeName(buyer?.nombre);
  return (threads || []).find((thread) => (
    thread.missionId === missionId
    && (
      (targetEmail && normalizeEmail(thread.contact?.email) === targetEmail)
      || (targetCompany && normalizeName(thread.contact?.company) === targetCompany)
    )
  )) || null;
}

function applyPlanToThread(thread, plan, { hasEmail, suppressed, now, buyer = {} }) {
  const drafts = thread.drafts || [];
  const missionDrafts = drafts.filter((draft) => draft.source === 'mision');
  const sentMissionDraft = missionDrafts.find((draft) => draft.status === 'enviado');
  if (sentMissionDraft) return { updated: false };

  let missionDraft = missionDrafts.find((draft) => draft.status !== 'descartado');
  if (!plan.body) {
    if (missionDraft) {
      missionDraft.status = 'revisar';
      missionDraft.reviewNote = plan.reviewNote || 'No hay un mensaje 1:1 para este comprador.';
      missionDraft.guardVersion = 2;
      thread.nextStep = nextStepFor(plan, hasEmail, buyer);
      thread.updatedAt = now;
      return { updated: true };
    }
    thread.nextStep = nextStepFor(plan, hasEmail);
    return { updated: false };
  }

  if (!missionDraft) {
    missionDraft = makeDraft(plan, hasEmail, now);
    thread.drafts = [missionDraft, ...drafts];
    thread.nextStep = nextStepFor(plan, hasEmail);
    thread.updatedAt = now;
    return { updated: true };
  }

  const contentChanged = missionDraft.subject !== plan.subject || missionDraft.body !== plan.body;
  const wasApproved = Boolean(missionDraft.approvedAt);
  const approvedReviewKind = missionDraft.approvedReviewKind || '';
  const lockedReview = Boolean(missionDraft.lockedReview);
  const oldReviewNote = missionDraft.reviewNote;
  const oldBlockedByOptOut = /opt-?out|pidi[oó] no recibir/i.test(missionDraft.blockedReason || '');
  const oldBlockedReason = missionDraft.blockedReason;

  missionDraft.subject = plan.subject;
  missionDraft.body = plan.body;
  missionDraft.commercialQuality = plan.commercialQuality || undefined;
  missionDraft.language = missionDraft.language || plan.language;
  missionDraft.reviewNote = plan.reviewNote || undefined;
  missionDraft.reviewKind = plan.reviewKind || undefined;
  missionDraft.blockedReason = plan.status === 'bloqueado' ? plan.blockedReason : undefined;
  missionDraft.complianceCorrections = plan.complianceCorrections || undefined;
  missionDraft.compliancePending = plan.compliancePending || undefined;
  missionDraft.revisionApplied = plan.revisionApplied || undefined;
  missionDraft.guardVersion = 2;

  if (contentChanged) {
    missionDraft.status = (wasApproved || lockedReview)
      ? (plan.status === 'bloqueado' ? 'bloqueado' : 'revisar')
      : plan.status;
    if (wasApproved) {
      missionDraft.reviewNote = 'El contenido cambió después de tu aprobación. Revisalo y aprobalo de nuevo.';
      delete missionDraft.approvedAt;
      delete missionDraft.approvedBy;
      delete missionDraft.approvedReviewKind;
    } else if (lockedReview) {
      missionDraft.reviewNote = oldReviewNote || 'Este borrador estaba marcado para revisión. Verificalo antes de enviarlo.';
    }
  } else if (wasApproved && plan.status !== 'bloqueado' && plan.reviewKind && plan.reviewKind === approvedReviewKind) {
    // El dueño ya aprobó este texto exacto con la misma advertencia delante
    // (por ejemplo, asumió el riesgo que marcó el red team). Revalidar no
    // puede borrar esa decisión si el contenido no cambió.
    missionDraft.status = 'listo';
  } else if (lockedReview) {
    // Una revisión obligatoria de la migración no se auto-aprueba: solo el
    // dueño puede levantarla con el botón Aprobar.
    missionDraft.status = plan.status === 'bloqueado' ? 'bloqueado' : 'revisar';
    if (missionDraft.status === 'revisar') {
      missionDraft.reviewNote = oldReviewNote || 'Este borrador estaba marcado para revisión. Verificalo antes de enviarlo.';
      delete missionDraft.approvedAt;
      delete missionDraft.approvedBy;
    }
  } else if (oldBlockedByOptOut && suppressed) {
    // La supresión manda: no se desbloquea sola.
    missionDraft.status = 'bloqueado';
    missionDraft.blockedReason = oldBlockedReason || 'El contacto pidió no recibir más mensajes (opt-out).';
  } else {
    missionDraft.status = plan.status;
    if (plan.status === 'revisar') {
      delete missionDraft.approvedAt;
      delete missionDraft.approvedBy;
    }
  }

  thread.nextStep = nextStepFor(plan, hasEmail);
  thread.updatedAt = now;
  return { updated: true };
}

function buildMissionNotices({ mission, skipped, missionThreads, state, updated }) {
  const notices = [];
  const prospects = (mission?.artifacts?.prospecting?.compradores || []).length;
  const verification = mission?.artifacts?.prospecting?.verificacion || {};
  if (!mission?.demo) {
    if (verification.directorio) {
      notices.push({
        type: 'directory',
        level: 'info',
        text: `Se sumaron ${verification.directorio} tienda${verification.directorio === 1 ? '' : 's'} del directorio semilla porque la búsqueda no alcanzó para cubrir los mercados. Cada una se verificó por su sitio en esta misión.`,
      });
    }
    if (!prospects) {
      notices.push({
        type: 'no-prospects',
        level: 'danger',
        text: `Esta misión no consiguió compradores verificados: no se creó ninguna conversación y no hay ventas posibles todavía. ${verification.candidatos ? `Se descartaron ${verification.descartados || verification.candidatos} candidatos por no poder comprobarlos. ` : ''}Revisá Ajustes → Búsqueda (o configurá Tavily/Brave/Serper), probá otro mercado y reintentá.`,
      });
    } else if (!missionThreads.length) {
      notices.push({
        type: 'no-threads',
        level: 'danger',
        text: `Se verificaron ${prospects} compradores pero no se creó ningún hilo nuevo${skipped.length ? ` (${skipped.length} quedaron fuera por duplicado, supresión o límite)` : ''}. La bandeja no tiene conversaciones nuevas para vender.`,
      });
    }
  }
  if (skipped.length) {
    notices.push({
      type: 'dedupe',
      level: 'info',
      text: `${skipped.length} comprador${skipped.length === 1 ? '' : 'es'} no se repitieron: ${skipped.slice(0, 4).map((item) => `${item.company} (${item.reason})`).join('; ')}${skipped.length > 4 ? '”¦' : ''}.`,
    });
  }
  const withoutDraft = missionThreads.filter((thread) => !(thread.drafts || []).length).length;
  if (withoutDraft) {
    notices.push({
      type: 'missing-message',
      level: 'warn',
      text: `${withoutDraft} hilo${withoutDraft === 1 ? '' : 's'} quedó sin borrador porque no había un mensaje 1:1. Escribilos a mano desde la bandeja.`,
    });
  }
  if (state.blocked) {
    notices.push({
      type: 'compliance',
      level: 'danger',
      text: `Los borradores están bloqueados: ${state.blockedReason}`,
    });
  } else if (state.redteamStop) {
    notices.push({
      type: 'redteam',
      level: 'warn',
      text: `${state.redteamReason || 'El red team pidió detener la misión.'} Los borradores quedaron Por aprobar: no se envían hasta que los revises y los apruebes.`,
    });
  } else if (state.missingReview) {
    notices.push({
      type: 'review',
      level: 'warn',
      text: 'Falta una revisión obligatoria (cumplimiento, red team o corrección post red team). Los borradores quedaron en revisión.',
    });
  }
  if (state.complianceUnresolved) {
    notices.push({
      type: 'compliance',
      level: 'warn',
      text: 'Cumplimiento pidió cambios sobre los mensajes pero ninguno coincide con el texto real. Los borradores quedaron en revisión para corregirlos a mano.',
    });
  } else if (state.complianceUnlocated) {
    notices.push({
      type: 'compliance-note',
      level: 'info',
      text: `${state.complianceUnlocated} corrección${state.complianceUnlocated === 1 ? '' : 'es'} de cumplimiento no coincide con ningún mensaje (puede ser de otro idioma o de contenido). Revisala en el paso de cumplimiento.`,
    });
  }
  if (updated) {
    notices.push({
      type: 'reconcile',
      level: 'info',
      text: `Se actualizaron ${updated} borrador${updated === 1 ? '' : 'es'} con la última revisión de la misión.`,
    });
  }
  return notices;
}

function missionDraftStats(missionThreads) {
  const drafts = missionThreads.flatMap((thread) => thread.drafts || []);
  return {
    draftsReady: drafts.filter((draft) => draft.status === 'listo').length,
    draftsToReview: drafts.filter((draft) => draft.status === 'revisar').length,
    draftsBlocked: drafts.filter((draft) => draft.status === 'bloqueado').length,
  };
}

const ACTIVE_STAGES = new Set(['respondio', 'interesado', 'negociando', 'ganado']);
const CLOSED_STAGES = new Set(['perdido']);

/* Un comprador no se repite dentro de la misma campaña, pero tampoco queda
   prohibido para siempre. Antes, el primer producto que lo contactaba lo
   bloqueaba para todos los demás: con un catálogo, la bandeja se agotaba en
   tres misiones. Ahora hay un enfriamiento configurable (90 días por defecto).
   Si respondió, está negociando, compró o pidió baja, no se vuelve a tocar. */
function findDuplicateContact(existingThreads, missionId, buyer, email, { cooldownDays = 90 } = {}) {
  const targetEmail = normalizeEmail(email);
  const targetDomain = emailDomain(targetEmail);
  const targetCompany = normalizeName(buyer?.nombre);
  const cooldownMs = Math.max(0, Number(cooldownDays) || 0) * 86400000;
  const now = Date.now();
  for (const thread of existingThreads || []) {
    if (!thread || thread.missionId === missionId) continue;
    const threadEmail = normalizeEmail(thread.contact?.email);
    let match = '';
    if (targetEmail && threadEmail && targetEmail === threadEmail) match = 'email';
    else if (targetEmail && targetDomain && !isSharedEmailDomain(targetDomain) && threadEmail) {
      const threadDomain = emailDomain(threadEmail);
      if (threadDomain && threadDomain === targetDomain) match = 'dominio';
    }
    // La empresa se compara siempre: un mismo comprador puede cambiar de
    // email o de dominio, y volver a escribirle sería un duplicado.
    if (!match && targetCompany && normalizeName(thread.contact?.company) === targetCompany) {
      match = 'empresa';
    }
    if (!match) continue;

    const stage = String(thread.stage || '');
    if (ACTIVE_STAGES.has(stage)) return { thread, reason: `${match} (conversación activa: ${stage})` };
    if (CLOSED_STAGES.has(stage)) return { thread, reason: `${match} (marcado como perdido)` };
    const outbound = (thread.messages || []).filter((message) => message.direction === 'out');
    const lastOutbound = outbound.reduce((max, message) => {
      const at = Date.parse(message.at || message.sentAt || 0) || 0;
      return Math.max(max, at);
    }, 0);
    const hasPendingDraft = (thread.drafts || []).some((draft) => ['listo', 'revisar'].includes(draft.status));
    if (!lastOutbound && hasPendingDraft) {
      return { thread, reason: `${match} (ya tiene un borrador sin enviar en la bandeja)` };
    }
    const last = lastOutbound || Date.parse(thread.createdAt || 0) || 0;
    if (cooldownMs > 0 && last && now - last < cooldownMs) {
      const remaining = Math.max(1, Math.ceil((cooldownMs - (now - last)) / 86400000));
      return { thread, reason: `${match} (contactado hace poco; faltan ${remaining} días de enfriamiento)` };
    }
  }
  return null;
}

async function syncThreads(mission, product, settings, store, { reconcile = false } = {}) {
  const allThreads = store.get('threads');
  const ownThreads = allThreads.filter((thread) => thread.missionId === mission.id);
  if (!reconcile && ownThreads.length) {
    return { created: 0, updated: 0, skipped: [], notices: mission.notices || [], stats: mission.stats || {} };
  }

  const buyers = mission.artifacts?.prospecting?.compradores || [];
  const limit = Math.min(buyers.length, Number(mission.maxProspects) || 12);
  const suppressions = (store.get('suppressions') || [])
    .filter((item) => mission.demo || !item.demo);
  // Los ejemplos demo no bloquean contactos reales (ni al revés).
  const comparableThreads = allThreads.filter((thread) => Boolean(thread.demo) === Boolean(mission.demo));
  const state = missionMessageState(mission);
  const reviewDirectory = settings?.mission?.reviewDirectory !== false;
  const now = nowISO();
  const skipped = [];
  const seen = new Set();
  let created = 0;
  let updated = 0;

  for (let index = 0; index < limit; index += 1) {
    const buyer = buyers[index] || {};
    const email = normalizeEmail(buyer.email);
    const hasEmail = isValidEmail(email) && !isDemoEmail(email);
    const company = String(buyer.nombre || buyer.contacto || `Comprador ${index + 1}`).trim();
    if (buyer.verificado === false) {
      skipped.push({ company, reason: 'no se pudo verificar el comprador' });
      continue;
    }
    const localKey = normalizeName(company) || email || `indice:${index}`;
    if (seen.has(localKey)) {
      skipped.push({ company, reason: 'duplicado en la misma misión' });
      continue;
    }
    seen.add(localKey);

    const suppression = isSuppressed(email, suppressions, company);
    if (suppression) {
      skipped.push({ company, reason: 'pidió no recibir más mensajes (opt-out)' });
      continue;
    }

    const plan = draftPlanForBuyer({ mission, product, buyer, state, reviewDirectory });
    const existing = findThreadForBuyer(allThreads, mission.id, buyer, email);
    if (existing) {
      const result = applyPlanToThread(existing, plan, { hasEmail, suppressed: false, now, buyer });
      if (result.updated) updated += 1;
      continue;
    }

    const duplicate = findDuplicateContact(comparableThreads, mission.id, buyer, email, {
      cooldownDays: settings?.mission?.contactCooldownDays ?? 90,
    });
    if (duplicate) {
      skipped.push({ company, reason: `ya contactado (${duplicate.reason})`, threadId: duplicate.thread.id });
      continue;
    }

    const thread = makeThread({ mission, product, buyer, email, hasEmail, company, plan, now });
    allThreads.unshift(thread);
    created += 1;
  }

  const missionThreads = allThreads.filter((thread) => thread.missionId === mission.id);
  if (created || updated) await store.set('threads', allThreads);

  mission.skippedProspects = skipped;
  const verifiedBuyers = buyers.filter((buyer) => buyer.verificado !== false);
  mission.stats = {
    ...(mission.stats || {}),
    prospects: verifiedBuyers.length,
    emails: verifiedBuyers.filter((buyer) => isValidEmail(buyer.email) && !isDemoEmail(buyer.email)).length,
    createdThreads: created,
    updatedThreads: updated,
    skippedProspects: skipped.length,
    messages: state.messages.length,
    ...missionDraftStats(missionThreads),
  };
  mission.notices = buildMissionNotices({ mission, skipped, missionThreads, state, updated });
  await persist(store, mission);
  return { created, updated, skipped, notices: mission.notices, stats: mission.stats };
}

export async function createThreads(mission, product, settings, store) {
  return syncThreads(mission, product, settings, store, { reconcile: false });
}

export async function reconcileThreads(mission, product, settings, store) {
  return syncThreads(mission, product, settings, store, { reconcile: true });
}

/* Migración de borradores creados antes de las guardas (v2):
   - si la misión no tiene la revisión obligatoria, quedan "por aprobar";
   - si dos hilos de la misma misión comparten cuerpo, el segundo no se
     envía a ciegas: queda "por aprobar" con una nota.
   Es idempotente: cada borrador se migra una sola vez. */
export async function migrateLegacyDrafts(store) {
  const threads = store.get('threads') || [];
  const seenBodies = new Map();
  const newlyMigrated = new Set();
  const missionsTouched = new Set();
  let changed = 0;
  for (const thread of threads) {
    if (!thread || typeof thread !== 'object') continue;
    const mission = thread.missionId ? store.find('missions', thread.missionId) : null;
    const reviewMissing = mission ? requiredReviewMissing(mission) : false;
    for (const draft of Array.isArray(thread.drafts) ? thread.drafts : []) {
      if (!draft || typeof draft !== 'object') continue;
      if (draft.guardVersion >= 2) continue;
      draft.guardVersion = 2;
      newlyMigrated.add(draft);
      changed += 1;
      if (draft.status !== 'listo') continue;
      if (reviewMissing) {
        draft.status = 'revisar';
        draft.reviewNote = 'Migración: la misión no tiene la revisión de cumplimiento o red team completa. Aprobá este borrador antes de enviarlo.';
        if (thread.missionId) missionsTouched.add(thread.missionId);
        continue;
      }
      const bodyKey = String(draft.body || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (!bodyKey) continue;
      const key = `${thread.missionId || 'sin-mision'}::${bodyKey}`;
      const firstThread = seenBodies.get(key);
      if (!firstThread) {
        seenBodies.set(key, thread.id);
      } else if (firstThread !== thread.id) {
        draft.status = 'revisar';
        draft.lockedReview = true;
        draft.reviewNote = 'Migración: este mensaje coincide con otro borrador de la misma misión. Verificá que sea 1:1 antes de enviarlo.';
        if (thread.missionId) missionsTouched.add(thread.missionId);
      }
    }
  }
  // Segunda pasada: contactos repetidos entre misiones distintas. No se borra
  // nada; el borrador queda para revisar con una nota clara.
  const seenContacts = new Map();
  const orderedThreads = [...threads].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  for (const thread of orderedThreads) {
    if (!thread || typeof thread !== 'object') continue;
    if (!thread.contact) continue;
    const scope = thread.demo ? 'demo' : 'real';
    const email = normalizeEmail(thread.contact.email);
    const company = normalizeName(thread.contact.company);
    const domain = emailDomain(email);
    const keys = [];
    if (email) keys.push(`${scope}:e:${email}`);
    if (company) keys.push(`${scope}:c:${company}`);
    if (domain && !isSharedEmailDomain(domain)) keys.push(`${scope}:d:${domain}`);
    if (!keys.length) continue;
    const previous = keys.map((key) => seenContacts.get(key)).find(Boolean);
    if (previous && previous.id !== thread.id) {
      for (const draft of Array.isArray(thread.drafts) ? thread.drafts : []) {
        if (!newlyMigrated.has(draft)) continue;
        if (draft.status !== 'listo') continue;
        draft.status = 'revisar';
        draft.lockedReview = true;
        draft.reviewNote = 'Migración: este contacto ya tiene otro hilo en la bandeja. Verificá que no sea un envío duplicado.';
        if (thread.missionId) missionsTouched.add(thread.missionId);
      }
    }
    for (const key of keys) {
      if (!seenContacts.has(key)) seenContacts.set(key, thread);
    }
  }

  if (changed) {
    await store.set('threads', threads);
    for (const missionId of missionsTouched) {
      const mission = store.find('missions', missionId);
      if (!mission) continue;
      const missionThreads = threads.filter((thread) => thread.missionId === missionId);
      mission.stats = { ...(mission.stats || {}), ...missionDraftStats(missionThreads) };
      await persist(store, mission);
    }
    await store.activity('system', `Migración de guardas: ${changed} borrador${changed === 1 ? '' : 'es'} revisado${changed === 1 ? '' : 's'}.`);
  }
  return { changed };
}

/* Una misión se lanza con un temporizador en memoria (server.mjs). Si el
   proceso se cierra, se deja detrás una misión "running" que ya no corre
   para nadie: bloquea reintentos, restauración de backups y borrado del
   producto ("Esperá a que termine"). Esta limpieza la devuelve a un estado
   reintentable, sin borrar nada de lo que ya se hizo.
   Las misiones "queued" NO se tocan: nunca empezaron y el arranque las
   retoma automáticamente para que una campaña larga sobreviva a un reinicio.
   Es idempotente y solo corre al arrancar una instancia nueva. */
export async function releaseInterruptedMissions(store, { staleAfterMs = 15 * 60 * 1000 } = {}) {
  const missions = store.get('missions') || [];
  const now = Date.now();
  const released = [];
  for (const mission of missions) {
    if (!mission || mission.status !== 'running') continue;
    if (running.has(mission.id)) continue;
    const last = Date.parse(mission.updatedAt || mission.startedAt || mission.createdAt || 0) || 0;
    if (last && now - last < staleAfterMs) continue;
    const failedStep = (mission.steps || []).find((step) => step.status === 'running')
      || (mission.steps || []).find((step) => step.status === 'pending');
    if (failedStep) {
      failedStep.status = 'error';
      if (!failedStep.error) failedStep.error = 'La misión se interrumpió antes de terminar este paso.';
      failedStep.endedAt = nowISO();
    }
    mission.status = 'error';
    mission.phase = 'error';
    mission.currentStep = null;
    mission.finishedAt = nowISO();
    mission.error = failedStep
      ? `${failedStep.title}: la misión se interrumpió (Lucian se cerró o reinició). Reintentá para retomarla desde este paso.`
      : 'La misión se interrumpió antes de terminar. Reintentá para retomarla.';
    await persist(store, mission);
    released.push(mission);
  }
  if (released.length) {
    await store.set('missions', missions);
    await store.activity('system', `Se liberaron ${released.length} misión${released.length === 1 ? '' : 'es'} interrumpida${released.length === 1 ? '' : 's'} por un cierre de Lucian.`);
  }
  return { released: released.length, ids: released.map((m) => m.id) };
}

async function createContent(mission, product, store) {
  const existing = store.get('content').some((c) => c.missionId === mission.id);
  if (existing) return 0;
  const calendar = mission.artifacts?.content?.calendario || [];
  const now = nowISO();
  const items = calendar.map((item) => ({
    id: uid('cnt'),
    demo: Boolean(mission.demo),
    missionId: mission.id,
    productId: product.id,
    platform: item.plataforma || '',
    format: item.formato || '',
    hook: item.gancho || '',
    script: item.guion || '',
    caption: item.caption || '',
    hashtags: item.hashtags || [],
    cta: item.cta || '',
    day: item.dia || '',
    status: 'idea',
    createdAt: now,
    updatedAt: now,
  }));
  if (items.length) {
    store.get('content').unshift(...items);
    await store.set('content', store.get('content'));
  }
  return items.length;
}

async function createLearnings(mission, product, store) {
  const existing = store.get('learnings').some((l) => l.missionId === mission.id);
  if (existing) return 0;
  const items = (mission.artifacts?.learning?.aprendizajes || []).map((item) => ({
    id: uid('lrn'),
    demo: Boolean(mission.demo),
    missionId: mission.id,
    scope: product.name,
    insight: item.insight,
    evidence: item.evidencia,
    confidence: item.confianza || 'media',
    apply: item.aplicar,
    tag: item.etiqueta || 'operacion',
    pinned: false,
    createdAt: nowISO(),
  }));
  if (items.length) {
    store.get('learnings').unshift(...items);
    await store.set('learnings', store.get('learnings'));
  }
  return items.length;
}

/* ─────────────────────────────────────────────────────────────
   Runner principal
   ───────────────────────────────────────────────────────────── */

export function missionWarnings(steps = []) {
  return (steps || [])
    .filter((step) => step.status === 'error')
    .map((step) => ({
      step: step.id,
      title: step.title,
      critical: Boolean(step.critical),
      error: step.error || 'Paso fallido.',
    }));
}

export function missionStatusForSteps(steps = []) {
  return missionWarnings(steps).length ? 'done_with_warnings' : 'done';
}

/* Memoria útil para esta misión: fijados y de confianza alta. Un ejemplo
   demo nunca entra en una misión real. */
export function selectRelevantLearnings(learnings = [], mission = {}) {
  const memoryPool = mission.demo ? learnings : learnings.filter((item) => !item.demo);
  return uniqueBy([
    ...memoryPool.filter((item) => item.pinned),
    ...memoryPool.filter((item) => !item.pinned && item.confidence === 'alta'),
  ], (item) => item.id).slice(0, 10);
}

/* Ejecuta un paso pero permite cancelarlo en caliente: si el dueño aprieta
   "Cancelar" mientras la IA está pensando, no esperamos a que el paso termine.
   El trabajo de fondo puede seguir unos segundos, pero la misión se marca
   cancelada de inmediato y la interfaz respponde al instante. */
class MissionCancelled extends Error {
  constructor() { super('MISIÓN CANCELADA POR EL DUEÑO'); this.name = 'MissionCancelled'; }
}

async function runStepCancellable(stepId, ctx, deps, mission) {
  const { store } = deps;
  const isCancelled = () => Boolean(
    mission.cancelRequested
    || store.get('missions').find((m) => m.id === mission.id)?.cancelRequested
    || store.get('missions').find((m) => m.id === mission.id)?.status === 'cancelled'
  );
  if (isCancelled()) throw new MissionCancelled();

  let timer = null;
  const cancelPromise = new Promise((_, reject) => {
    timer = setInterval(() => {
      if (isCancelled()) {
        clearInterval(timer);
        reject(new MissionCancelled());
      }
    }, 300);
  });

  try {
    const output = await Promise.race([
      executeStep(stepId, ctx, deps),
      cancelPromise,
    ]);
    if (isCancelled()) throw new MissionCancelled();
    return output;
  } finally {
    if (timer) clearInterval(timer);
  }
}

async function runMissionNow(missionId, deps) {
  const { store, broadcast, notifier } = deps;
  if (running.has(missionId)) return;
  running.add(missionId);

  const missions = store.get('missions');
  const mission = missions.find((m) => m.id === missionId);
  if (!mission) { running.delete(missionId); return; }

  const product = store.find('products', mission.productId);
  if (!product) {
    mission.status = 'error';
    mission.error = 'El producto de esta misión ya no existe.';
    mission.finishedAt = nowISO();
    await persist(store, mission);
    emitMission(broadcast, mission);
    running.delete(missionId);
    return;
  }

  const settings = store.settings();
  const aiChoice = resolveAIWithFallback(settings);
  const cfg = aiChoice.cfg;
  if (aiChoice.isFallback && mission.status !== 'queued') {
    const fallbackNote = `IA de respaldo activa: ${aiChoice.reason}`;
    await logMission(store, broadcast, mission, fallbackNote);
    // Aviso por Telegram: el dueño sabe que el cerebro cambió solo.
    if (deps.notifier?.notify) {
      deps.notifier.notify(
        `🔄 *Lucian cambió de IA automáticamente*\n\n${fallbackNote}\n\nSeguí vendiendo con normalidad: el respaldo es local, gratis e ilimitado.`,
        { kind: 'system' },
      ).catch(() => {});
    }
  }
  const demo = Boolean(mission.demo || mission.mode === 'demo');

  // Si el dueño canceló la misión mientras estaba en cola, no debe arrancar
  // igual: el temporizador de creación no puede revivirla.
  if (mission.status === 'cancelled') {
    running.delete(missionId);
    return;
  }

  mission.status = 'running';
  mission.error = null;
  mission.finishedAt = null;
  mission.cancelRequested = false;
  mission.startedAt = mission.startedAt || nowISO();
  mission.progress = Number(mission.progress) || 0;
  mission.usage = [];

  const pipeline = pipelineFor(mission);
  mission.steps = Array.isArray(mission.steps) ? mission.steps : [];
  for (const stepId of pipeline) {
    if (!mission.steps.find((s) => s.id === stepId)) {
      const def = STEPS[stepId];
      mission.steps.push({
        id: stepId,
        agent: def.agent,
        title: def.title,
        status: 'pending',
        critical: Boolean(def.critical),
        startedAt: null,
        endedAt: null,
        durationMs: null,
        summary: '',
        error: null,
        tokens: 0,
      });
    }
  }

  await persist(store, mission);
  emitMission(broadcast, mission);
  await store.activity('mission', `Misión iniciada: ${mission.name}.`, { missionId, demo });
  await logMission(store, broadcast, mission, demo
    ? 'Modo demo: el equipo va a simular la misión completa con datos de ejemplo.'
    : 'Misión iniciada. El equipo empieza por el brief y sigue en orden.');

  if (!demo && !isAIReady(settings)) {
    mission.status = 'error';
    mission.error = 'Falta configurar una IA. Abrí Ajustes → Inteligencia artificial o lanzá la misión en modo demo.';
    mission.finishedAt = nowISO();
    await persist(store, mission);
    emitMission(broadcast, mission);
    await store.activity('mission', `Misión con error: ${mission.name}. Falta IA.`, { missionId });
    running.delete(missionId);
    return;
  }

  /* La memoria deja de ser decorativa: los aprendizajes fijados y los de
     confianza alta entran en el contexto de la próxima misión. Los ejemplos
     del modo demo nunca contaminan una misión real. */
  const relevantLearnings = selectRelevantLearnings(store.get('learnings') || [], mission);

  const ctx = {
    mission,
    product,
    brand: settings.brand,
    settings,
    cfg,
    artifacts: mission.artifacts || {},
    learnings: relevantLearnings,
    search: null,
    fallback: settings.fallback?.ollama || null,
  };
  mission.artifacts = ctx.artifacts;
  const usage = [];

  try {
    for (const stepId of pipeline) {
      if (mission.cancelRequested || store.get('missions').find((m) => m.id === mission.id)?.cancelRequested) {
        mission.status = 'cancelled';
        mission.finishedAt = nowISO();
        mission.phase = 'cancelled';
        await persist(store, mission);
        emitMission(broadcast, mission);
        await logMission(store, broadcast, mission, 'Misión cancelada por el dueño.');
        await store.activity('mission', `Misión cancelada: ${mission.name}.`, { missionId });
        running.delete(missionId);
        return;
      }

      const step = mission.steps.find((s) => s.id === stepId);
      if (!step) continue;
      if (step.status === 'done' && mission.artifacts[stepId]) {
        continue;
      }

      const def = STEPS[stepId];
      mission.phase = phaseFor(stepId);
      step.status = 'running';
      step.startedAt = nowISO();
      step.endedAt = null;
      step.error = null;
      step.summary = '';
      mission.currentStep = stepId;
      await persist(store, mission);
      emitStep(broadcast, mission, step);
      await logMission(store, broadcast, mission, `${getAgent(def.agent).name}: ${def.title.toLowerCase()}.`);

      const started = Date.now();
      try {
        // Detección de cancelación DURANTE el paso: si el dueño cancela
        // mientras la IA está respondiendo, no esperamos a que termine.
        const output = await runStepCancellable(stepId, ctx, { store, broadcast, notifier, usage }, mission);
        ctx.artifacts[stepId] = output;
        mission.artifacts[stepId] = output;
        step.status = 'done';
        step.endedAt = nowISO();
        step.durationMs = Date.now() - started;
        step.summary = summarizeStep(stepId, output);
        step.tokens = usage.filter((u) => u.stepId === stepId).reduce((acc, u) => acc + u.tokens, 0);
        const doneCount = pipeline.filter((id) => mission.steps.find((s) => s.id === id)?.status === 'done').length;
        mission.progress = Math.round((doneCount / pipeline.length) * 100);
        await store.trackAgent(def.agent);
        await persist(store, mission);
        emitStep(broadcast, mission, step);
        await logMission(store, broadcast, mission, `${def.title}: listo. ${step.summary}`, 'done');
      } catch (error) {
        if (error instanceof MissionCancelled) {
          // Cancelación limpia: no es un error del paso.
          mission.status = 'cancelled';
          mission.phase = 'cancelled';
          mission.finishedAt = nowISO();
          mission.currentStep = null;
          step.status = 'error';
          step.endedAt = nowISO();
          step.error = 'Cancelada por el dueño';
          await persist(store, mission);
          emitMission(broadcast, mission);
          await logMission(store, broadcast, mission, 'Misión cancelada por el dueño.');
          await store.activity('mission', `Misión cancelada: ${mission.name}.`, { missionId });
          running.delete(missionId);
          return;
        }
        step.status = 'error';
        step.endedAt = nowISO();
        step.durationMs = Date.now() - started;
        step.error = humanError(error);
        mission.error = `${def.title}: ${step.error}`;
        await persist(store, mission);
        emitStep(broadcast, mission, step);
        await logMission(store, broadcast, mission, `${def.title} falló: ${step.error}`, 'error');
        if (def.critical) throw new Error(mission.error);
      }
    }

    if (!mission.artifacts.synthesis) {
      throw new Error('La misión terminó sin plan final. Revisá el error del último paso y reintentá.');
    }

    const synthesis = mission.artifacts.synthesis;
    const warnings = missionWarnings(mission.steps);
    mission.summary = synthesis.resumen || synthesis.decision || 'Plan final listo.';
    mission.phase = 'finished';
    mission.progress = 100;
    mission.finishedAt = nowISO();
    mission.currentStep = null;
    mission.cancelRequested = false;

    const buyers = mission.artifacts.prospecting?.compradores || [];
    const messages = missionMessageState(mission).messages;
    mission.stats = {
      calls: usage.length || pipeline.filter((id) => STEPS[id] && !STEPS[id].tool).length,
      tokens: usage.reduce((acc, u) => acc + u.tokens, 0),
      prospects: buyers.length,
      emails: buyers.filter((buyer) => isValidEmail(buyer.email) && !isDemoEmail(buyer.email)).length,
      messages: messages.length,
      durationMs: new Date(mission.finishedAt) - new Date(mission.startedAt),
    };

    const autoCreateThreads = settings.mission?.autoCreateThreads !== false;
    let sync = { created: 0, updated: 0, skipped: [], notices: [] };
    if (autoCreateThreads) {
      const hasThreads = store.get('threads').some((thread) => thread.missionId === mission.id);
      // Reintentar una misión no puede dejar los borradores viejos intactos:
      // si ya hay hilos, se reconcilian con la última revisión.
      sync = hasThreads
        ? await reconcileThreads(mission, product, settings, store)
        : await createThreads(mission, product, settings, store);
    }
    const createdThreads = sync.created;
    const updatedThreads = sync.updated;
    const createdContent = await createContent(mission, product, store);
    const createdLearnings = await createLearnings(mission, product, store);

    /* Honestidad del cierre: una misión real sin compradores verificados no
       puede presentarse como un éxito. El plan puede estar bien, pero no hay
       a quién venderle todavía. */
    const missionThreads = store.get('threads').filter((thread) => thread.missionId === mission.id);
    const finalState = missionMessageState(mission);
    if (!demo && buyers.length === 0 && !warnings.some((warning) => warning.step === 'prospecting')) {
      const searchErrors = mission.artifacts.prospecting?.busqueda?.errores || [];
      warnings.push({
        step: 'prospecting',
        title: 'Compradores concretos',
        critical: false,
        error: `0 compradores verificados: no se creó ninguna conversación, así que esta misión todavía no puede vender.${searchErrors.length ? ` La búsqueda web falló: ${truncate(searchErrors[0], 180)}` : ' Revisá los descartes del paso de compradores.'}`,
      });
    }
    if (!demo && finalState.blocked && !warnings.some((warning) => warning.step === 'compliance')) {
      warnings.push({
        step: 'compliance',
        title: 'Cumplimiento',
        critical: false,
        error: `Los borradores quedaron bloqueados: ${finalState.blockedReason}`,
      });
    }
    if (!demo && finalState.redteamStop && !warnings.some((warning) => warning.step === 'redteam')) {
      warnings.push({
        step: 'redteam',
        title: 'Red team',
        critical: false,
        error: `${finalState.redteamReason} Los borradores quedaron Por aprobar.`,
      });
    }
    mission.warnings = warnings;
    mission.error = warnings.length ? '' : mission.error;
    mission.status = warnings.length ? 'done_with_warnings' : 'done';

    await persist(store, mission);
    emitMission(broadcast, mission);
    const warningText = warnings.length
      ? ` La misión quedó con ${warnings.length} aviso${warnings.length === 1 ? '' : 's'}: ${warnings.map((warning) => warning.title).join(', ')}.`
      : '';
    const threadText = updatedThreads
      ? `${createdThreads} hilos nuevos y ${updatedThreads} borradores actualizados en la bandeja`
      : `${createdThreads} hilos en la bandeja`;
    const prospectText = buyers.length
      ? `${buyers.length} compradores verificados`
      : '0 compradores verificados: no hay a quién venderle todavía y no se envió nada';
    await logMission(store, broadcast, mission, `Misión terminada. ${prospectText}. ${threadText}, ${createdContent} piezas de contenido, ${createdLearnings} aprendizajes.${warningText}`, warnings.length ? 'warn' : 'done');
    await store.activity('mission', `Misión ${warnings.length ? 'terminada con avisos' : 'completada'}: ${mission.name}. ${prospectText}. ${threadText}.`, { missionId, demo, warnings: warnings.length, prospects: buyers.length });
    await store.setMeta({ lastMissionAt: nowISO() });

    if (!demo && notifier) {
      const text = [
        `Misión terminada: ${mission.name}`,
        '',
        truncate(mission.summary, 700),
        '',
        warnings.length
          ? `${prospectText}. ${threadText}. Avisos: ${warnings.map((warning) => warning.title).join(', ')}.`
          : `${prospectText}. ${threadText}.`,
      ].join('\n');
      await notifier.notify(text, { kind: warnings.length ? 'mission_warning' : 'mission_done' }).catch(() => {});
    }

    // El piloto automático (si está activo) encola los borradores listos.
    // Se hace acá y no en el servidor para que también cubra reintentos.
    if (!demo && typeof deps.onMissionFinished === 'function') {
      try {
        await deps.onMissionFinished(mission);
      } catch (error) {
        console.error('[Lucian] No se pudo encolar el envío automático:', error?.message || error);
      }
    }
  } catch (error) {
    mission.status = mission.cancelRequested ? 'cancelled' : 'error';
    mission.error = humanError(error);
    mission.finishedAt = nowISO();
    mission.currentStep = null;
    mission.phase = mission.status === 'cancelled' ? 'cancelled' : 'error';
    await persist(store, mission);
    emitMission(broadcast, mission);
    await logMission(store, broadcast, mission, `La misión se detuvo: ${mission.error}`, 'error');
    await store.activity('mission', `Misión con error: ${mission.name}. ${mission.error}`, { missionId, demo });
    if (!demo && notifier && mission.status === 'error') {
      await notifier.notify(`No pude terminar “${mission.name}”.\n\n${mission.error}\n\nPodés reintentar desde Lucian.`, { kind: 'mission_error' }).catch(() => {});
    }
  } finally {
    running.delete(missionId);
  }
}

/* Puerta de entrada de las misiones.
   Antes, lanzar 20 misiones abría 20 pipelines a la vez: las búsquedas se
   amontonaban y la IA recibía ráfagas que terminaban en 429/413. Ahora las
   misiones esperan en cola (por defecto 2 activas) y arrancan en orden.
   El estado sigue siendo "queued" hasta que les toca, así la UI no miente. */
const missionGate = createSemaphore(Math.max(1, Math.min(4, Number(process.env.LUCIAN_MAX_MISSIONS) || 2)));
const waitingMissions = new Set();

export async function runMission(missionId, deps) {
  const { store } = deps;
  if (running.has(missionId) || waitingMissions.has(missionId)) return;
  const mission = store.find('missions', missionId);
  if (!mission || mission.status === 'cancelled') return;
  waitingMissions.add(missionId);
  try {
    await missionGate(async () => {
      waitingMissions.delete(missionId);
      const current = store.find('missions', missionId);
      if (!current || current.status === 'cancelled') return;
      await runMissionNow(missionId, deps);
    });
  } finally {
    waitingMissions.delete(missionId);
  }
}

export function missionQueueSize() {
  return { active: running.size, waiting: waitingMissions.size, max: Math.max(1, Math.min(4, Number(process.env.LUCIAN_MAX_MISSIONS) || 2)) };
}

/* ─────────────────────────────────────────────────────────────
   Consultas al equipo y análisis de respuestas
   ───────────────────────────────────────────────────────────── */

function askContext(store) {
  const settings = store.settings();
  const products = store.get('products').slice(0, 8).map((p) => ({
    nombre: p.name, codigo: p.code, precio: p.price, moneda: p.currency, costo: p.cost, estado: p.status,
  }));
  const missions = store.get('missions').slice(0, 5).map((m) => ({
    nombre: m.name, estado: m.status, mercados: m.markets, resumen: m.summary,
    decision: m.artifacts?.synthesis?.decision,
    riesgo: m.artifacts?.redteam?.sello,
    precios: m.artifacts?.pricing?.recomendacion,
    aduanas: m.artifacts?.customs?.resumen,
  }));
  const threads = store.get('threads').slice(0, 10).map((t) => ({
    empresa: t.contact?.company, pais: t.contact?.country, etapa: t.stage, score: t.score,
    siguiente: t.nextStep,
    ultimo: t.messages?.[t.messages.length - 1]?.body?.slice(0, 300),
    // Correos enviados y borradores: para que el Redactor pueda revisar
    // el tono de la secuencia sin que el dueño tenga que pegarlos a mano.
    correos: (t.messages || []).filter((m) => m.direction === 'out').slice(-4).map((m) => ({
      fecha: String(m.at || '').slice(0, 10), asunto: m.subject || '', texto: String(m.body || '').slice(0, 400),
    })),
    borradores: (t.drafts || []).slice(0, 4).map((d) => ({
      estado: d.status, origen: d.source || '', asunto: d.subject || '', texto: String(d.body || '').slice(0, 400),
    })),
  }));
  const learnings = store.get('learnings').slice(0, 10).map((l) => ({ insight: l.insight, etiqueta: l.tag, confianza: l.confidence }));
  return {
    marca: { nombre: settings.brand?.name, hacedor: settings.brand?.maker, ciudad: settings.brand?.city, web: settings.brand?.website },
    productos: products,
    misiones: missions,
    conversaciones: threads,
    aprendizajes: learnings,
    fecha: nowISO().slice(0, 10),
  };
}

function extractAnswerText(text) {
  const s = String(text || '').trim();
  if (!s.startsWith('{')) return s;
  try {
    const obj = JSON.parse(s);
    for (const key of ['answer', 'respuesta', 'text', 'response', 'mensaje']) {
      if (typeof obj[key] === 'string') return obj[key].trim();
    }
  } catch { /* no era JSON */ }
  return s;
}

function dedupeText(text) {
  const s = String(text || '').trim();
  if (!s) return s;
  const mid = Math.floor(s.length / 2);
  if (s.slice(mid).trim() === s.slice(0, mid).trim()) return s.slice(0, mid).trim();
  const parts = s.split(/\n\s*\n/);
  if (parts.length % 2 === 0) {
    const h = parts.length / 2;
    if (parts.slice(0, h).join('\n\n').trim() === parts.slice(h).join('\n\n').trim()) {
      return parts.slice(0, h).join('\n\n').trim();
    }
  }
  return s;
}

function offlineStatusAnswer(store, question = '') {
  const products = store.get('products') || [];
  const missions = store.get('missions') || [];
  const threads = store.get('threads') || [];
  const content = store.get('content') || [];
  const active = missions.filter((m) => ['running', 'queued'].includes(m.status));
  const drafts = threads.flatMap((t) => t.drafts || []).filter((d) => d.status === 'listo');
  const review = threads.flatMap((t) => t.drafts || []).filter((d) => d.status === 'revisar');
  const hot = threads.filter((t) => ['interesado', 'negociando', 'respondio'].includes(t.stage));
  const won = threads.filter((t) => t.stage === 'ganado');
  const ideas = content.filter((c) => c.status === 'idea' || c.status === 'borrador');
  const lines = [
    `📊 *Lucian — estado real de hoy*`,
    ``,
    `Productos en catálogo: ${products.length}`,
    `Misiones activas: ${active.length}${active.length ? ` (${active[0].name}${active[0].progress ? ` ${active[0].progress}%` : ''})` : ''}`,
    `Leads calientes: ${hot.length}`,
    `Ventas cerradas: ${won.length}`,
    `Borradores listos para enviar: ${drafts.length}`,
    `Borradores por aprobar: ${review.length}`,
    `Piezas de contenido listas: ${ideas.length}`,
  ];
  if (active.length) lines.push(`\nEn curso: ${active.map((m) => `${m.name} (${m.progress || 0}%)`).join(', ')}`);
  lines.push(`\n⚠️ La IA está sin saldo, así que este resumen sale directo de tus datos. Para volver a conversar con el equipo, cargá crédito en el proveedor o configurá un modelo local con memoria disponible.`);
  return lines.join('\n');
}

export async function askTeam({ question, agentId = 'director', store, history = [], channel = 'web', images = [] }) {
  const settings = store.settings();
  const agent = getAgent(agentId);
  if (!isAIReady(settings)) {
    return { ...demoAsk(agentId, question), agent };
  }
  const aiChoice = resolveAIWithFallback(settings);
  const cfg = aiChoice.cfg;
  if (aiChoice.isFallback) {
    await store.activity('system', `Agente ${agent.name} usando IA de respaldo: ${aiChoice.reason}`);
  }
  const context = askContext(store);
  if (channel === 'telegram') {
    const q = String(question || '').toLowerCase();
    const match = (store.get('threads') || []).find((t) => {
      const company = String(t.contact?.company || '').trim().toLowerCase();
      return company && company.length >= 4 && q.includes(company);
    });
    if (match) {
      context.hilo_detectado = {
        empresa: match.contact?.company,
        pais: match.contact?.country,
        etapa: match.stage,
        score: match.score,
        siguiente: match.nextStep,
        mensajes: (match.messages || []).slice(-6).map((m) => ({ dir: m.direction, texto: String(m.body || '').slice(0, 400) })),
        borrador: (match.drafts || []).slice(-1)[0] || null,
      };
    }
  }
  let result;
  try {
    result = await aiGate(() => chat(cfg, {
      system: systemFor(agent.id),
      prompt: askPrompt(agent.id, question, context, { history, channel }),
      temperature: channel === 'telegram' ? 0.5 : 0.55,
      maxTokens: channel === 'telegram' ? 1800 : 1300,
      images: Array.isArray(images) ? images : [],
      fallback: settings.fallback?.ollama || null,
    }));
  } catch (error) {
    // Si la IA (y su respaldo) fallan, responder con un resumen REAL de los
    // datos en vez de un error. El dueño nunca se queda sin respuesta.
    const summary = offlineStatusAnswer(store, question);
    await store.activity('system', `Agente respondió en modo sin IA: ${error.message.slice(0, 120)}`);
    return { answer: summary, agent, demo: true, offline: true, usage: null, note: 'IA sin saldo: respuesta basada en datos reales de Lucian.' };
  }
  await store.trackAgent(agent.id);
  return {
    answer: dedupeText(extractAnswerText(result.text)),
    agent,
    demo: false,
    usage: result.usage,
  };
}

export async function analyzeThread({ thread, store, apply = true }) {
  const settings = store.settings();
  const product = store.find('products', thread.productId);
  let analysis;

  if (thread.demo) {
    analysis = demoReply(thread, settings.brand);
  } else if (!isAIReady(settings)) {
    throw new Error('Para analizar respuestas reales necesitás configurar una IA en Ajustes → Inteligencia artificial.');
  } else {
    const cfg = resolveAIConfig(settings);
    const result = await aiGate(() => generateJson(cfg, {
      system: systemFor('analista'),
      prompt: replyPrompt(thread, product, settings.brand),
      temperature: 0.3,
      maxTokens: 1400,
      expects: 'object',
      attempts: 3,
      fallback: settings.fallback?.ollama || null,
    }));
    analysis = asObject(result.data);
    await store.trackAgent('analista');
  }

  analysis.score = clamp(asNumber(analysis.score, 50), 0, 100);
  if (!['nuevo', 'contactado', 'respondio', 'interesado', 'negociando', 'ganado', 'perdido'].includes(analysis.etapa)) {
    analysis.etapa = analysis.intencion === 'no_gracias' ? 'perdido' : 'respondio';
  }
  analysis.borrador = {
    asunto: asString(analysis.borrador?.asunto || `Re: ${thread.messages?.[thread.messages.length - 1]?.subject || ''}`),
    cuerpo: asString(analysis.borrador?.cuerpo),
  };

  if (apply) {
    const threads = store.get('threads');
    const stored = threads.find((t) => t.id === thread.id);
    if (stored) {
      stored.score = analysis.score;
      stored.lastAnalysis = { ...analysis, at: nowISO() };
      stored.updatedAt = nowISO();
      if (analysis.etapa) {
        stored.stage = analysis.etapa;
        // El reloj de postventa empieza en la venta: sin ancla, la
        // fidelización (día 3/30/90) nunca se dispara.
        if (analysis.etapa === 'ganado' && !stored.postSaleAt) stored.postSaleAt = nowISO();
      }
      if (analysis.siguiente_paso) stored.nextStep = asString(analysis.siguiente_paso);
      if (analysis.nota) stored.notes = [asString(stored.notes), asString(analysis.nota)].filter(Boolean).join('\n');
      if (analysis.borrador.cuerpo && !stored.drafts.some((d) => d.body === analysis.borrador.cuerpo)) {
        stored.drafts.unshift({
          id: uid('drf'),
          channel: 'email',
          language: 'es',
          subject: analysis.borrador.asunto || 'Respuesta',
          body: analysis.borrador.cuerpo,
          status: 'listo',
          source: 'ia',
          guardVersion: 2,
          createdAt: nowISO(),
        });
      }
      await store.set('threads', threads);
    }
    await store.activity('reply', `Respuesta analizada: ${thread.contact?.company || 'contacto'} (${analysis.intencion}).`, { threadId: thread.id, score: analysis.score });
  }

  return { analysis, thread: store.find('threads', thread.id) || thread };
}

export { running as runningMissions };
