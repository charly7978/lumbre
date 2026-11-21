import { truncate } from './util.mjs';
import { marketBlock, COPYWRITING_RULES } from './market-intel.mjs';

/* ─────────────────────────────────────────────────────────────
   El equipo. Cada agente tiene una responsabilidad distinta y
   entrega un JSON con forma fija para que la app lo pueda mostrar.
   ───────────────────────────────────────────────────────────── */

export const AGENTS = [
  {
    id: 'director',
    name: 'Director Comercial',
    initials: 'DC',
    role: 'Estrategia y decisiones',
    color: '#c98a3c',
    bio: 'Convierte el producto y el objetivo en una tesis comercial concreta. Decide a quién venderle primero, con qué ángulo y qué no hacer.',
    focus: ['Tesis comercial', 'Prioridades', 'Plan de 7 días'],
  },
  {
    id: 'mercado',
    name: 'Analista de Mercado',
    initials: 'AM',
    role: 'Investigación y competencia',
    color: '#6f8173',
    bio: 'Lee el mercado real: tiendas, competidores, precios, temporadas y términos de búsqueda. Separa moda de demanda.',
    focus: ['Tendencias', 'Competidores', 'Canales'],
  },
  {
    id: 'aduanas',
    name: 'Especialista en Aduanas',
    initials: 'EA',
    role: 'Importación y logística',
    color: '#63788a',
    bio: 'Anticipa aranceles, impuestos, certificaciones y etiquetado antes de que un envío quede trabado.',
    focus: ['Aranceles', 'Certificaciones', 'Couriers'],
  },
  {
    id: 'precios',
    name: 'Analista de Precios',
    initials: 'AP',
    role: 'Márgenes y rentabilidad',
    color: '#b56c4a',
    bio: 'Calcula costo aterrizado, precio directo, mayorista y galería. Busca el punto donde el precio no frena la venta ni te deja sin margen.',
    focus: ['Landed cost', 'Márgenes', 'Descuentos'],
  },
  {
    id: 'cazador',
    name: 'Cazador de Compradores',
    initials: 'CC',
    role: 'Prospección',
    color: '#8b7654',
    bio: 'Encuentra tiendas, distribuidores, interioristas y hoteles que ya venden diseño. Verifica contactos y descarta fantasmas.',
    focus: ['Prospectos', 'Contactos', 'Priorización'],
  },
  {
    id: 'redactor',
    name: 'Redactor Comercial',
    initials: 'RC',
    role: 'Mensajes que abren puertas',
    color: '#a65d3f',
    bio: 'Escribe correos breves, específicos y humanos. Nada de plantillas con “espero que estés bien”. Un solo pedido por mensaje.',
    focus: ['Secuencias', 'Personalización', 'Objeciones'],
  },
  {
    id: 'contenido',
    name: 'Director de Contenido',
    initials: 'CO',
    role: 'Redes y narrativa',
    color: '#9a6f8e',
    bio: 'Diseña contenido que muestra el objeto y el proceso, no que grita “comprá”. Piensa en series, no en posts sueltos.',
    focus: ['Calendario', 'Ganchos', 'Series'],
  },
  {
    id: 'cumplimiento',
    name: 'Guardián de Cumplimiento',
    initials: 'GC',
    role: 'Riesgos legales y reputación',
    color: '#6a7a86',
    bio: 'Revisa afirmaciones, bases legales de contacto, opt-out y promesas. Prefiere perder una venta antes que quemar la marca.',
    focus: ['Claims', 'Privacidad', 'Revisión'],
  },
  {
    id: 'redteam',
    name: 'Abogado del Diablo',
    initials: 'AD',
    role: 'Contradicción',
    color: '#8f4f45',
    bio: 'Su trabajo es encontrar por qué el plan puede fallar. Sin crueldad y sin diplomacia: si un número no cierra, lo dice.',
    focus: ['Supuestos', 'Agujeros', 'Escenarios'],
  },
  {
    id: 'memoria',
    name: 'Memoria y Aprendizaje',
    initials: 'MA',
    role: 'Aprendizaje acumulado',
    color: '#7c7a5c',
    bio: 'Extrae lo que esta misión enseñó para que la próxima no empiece de cero. Guarda solo lo que tiene evidencia.',
    focus: ['Aprendizajes', 'Patrones', 'Confianza'],
  },
  {
    id: 'analista',
    name: 'Analista de Respuestas',
    initials: 'AR',
    role: 'Bandeja y seguimiento',
    color: '#5f7b72',
    bio: 'Lee lo que respondió el comprador, detecta la intención real y propone el siguiente paso sin sonar desesperado.',
    focus: ['Intención', 'Siguiente paso', 'Borradores'],
  },
];

export function getAgent(id) {
  return AGENTS.find((agent) => agent.id === id) || AGENTS[0];
}

const COMMON_RULES = `
REGLAS DEL EQUIPO:
- No inventes datos verificables: precios de competidores, aranceles exactos, certificaciones, nombres de compradores ni direcciones de correo. Si no hay evidencia, escribí "sin dato" o "supuesto".
- Nunca rellenes una lista con categorías genéricas ni nombres de fantasía ("tienda de diseño independiente", "hotel boutique", "estudio de interiorismo"). Un comprador sin nombre real y sin sitio web verificable no se entrega: es mejor devolver la lista vacía y explicar qué falta.
- Cuando uses una fuente, incluí la URL en el campo correspondiente. No cites una fuente que no aparezca en los datos entregados.
- Escribí en español rioplatense neutro, profesional y concreto. Los mensajes a compradores van en el idioma del país (inglés si no es hispanohablante).
- Nada de promesas de resultados, urgencia falsa, superlativos vacíos ni presión. El tono es seguro, específico y humano.
- La marca se llama LUCIAN. No es una ciudad ni una localidad. Nunca le agregues entre paréntesis la ciudad del dueño ni escribas 'LUCIAN (Caseros)' en el saludo, la presentación, el asunto o la firma. La localidad puede ser un dato interno o postal, no parte del nombre de marca.
- Nunca atribuyas al producto autoría, diseño propio o una fabricación de origen que no estén confirmados por sus datos.
- Los precios y aranceles son estimaciones de trabajo, no asesoría legal ni contable. Marcá los supuestos.
- El dueño es un maker solo: el plan tiene que caber en su tiempo y presupuesto reales.
- Sé breve: cada campo de texto, máximo 2 frases; cada lista, máximo 5 elementos, salvo que la tarea pida otro número. Un JSON cortado no sirve.
- Devolvé SOLO el JSON pedido. Sin markdown, sin explicaciones afuera del JSON.
${COPYWRITING_RULES}
`;

export function systemFor(agentId) {
  const agent = getAgent(agentId);
  return `Sos ${agent.name} del equipo comercial de LUCIAN, una marca que comercializa productos de iluminación. El origen y autoría de cada producto deben extraerse de su ficha; no presupongas que LUCIAN diseñó cada lámpara.
Tu rol: ${agent.role}. ${agent.bio}
Tu estándar: pensás como alguien con diez años vendiendo diseño a tiendas y estudios, no como un generador de contenido.
${COMMON_RULES}`;
}

/* ─────────────────────────────────────────────────────────────
   Utilidades de contexto
   ───────────────────────────────────────────────────────────── */

function jsonBlock(label, value, max = 6000) {
  if (value === undefined || value === null) return '';
  return `\n${label}:\n${truncate(JSON.stringify(value, null, 2), max)}\n`;
}

function brandBlock(ctx) {
  const b = ctx.brand || {};
  return jsonBlock('MARCA', {
    nombre: b.name,
    hacedor: b.maker,
    propuesta: b.tagline,
    ciudad: b.city,
    pais: b.country,
    web: b.website,
    instagram: b.instagram,
    moneda: b.currency || ctx.settings?.mission?.currency,
    idiomas: b.languages,
  }, 1200);
}

function productBlock(ctx) {
  const p = ctx.product || {};
  return jsonBlock('PRODUCTO', {
    nombre: p.name,
    codigo: p.code,
    precio: p.price,
    moneda: p.currency,
    costo: p.cost,
    peso_gramos: p.weightGrams,
    medidas: p.dimensions,
    materiales: p.materials,
    descripcion: p.description,
    notas: p.notes,
    fotos: (p.photos || []).length,
    categoria: p.category,
  }, 2500);
}

function missionBlock(ctx) {
  const m = ctx.mission || {};
  return jsonBlock('MISIÓN', {
    objetivo: m.goal,
    mercados: m.markets,
    profundidad: m.depth,
    tono: m.tone,
    presupuesto_envio: m.budget,
    notas: m.notes,
    limite_compradores: m.maxProspects,
  }, 1800);
}

function learningsBlock(ctx) {
  const list = (ctx.learnings || []).filter((l) => l && (l.pinned || l.confidence === 'alta')).slice(0, 10);
  if (!list.length) return '';
  const lines = ['\nAPRENDIZAJES DE MISIONES ANTERIORES (usar como evidencia, no como verdad absoluta):'];
  list.forEach((l, i) => {
    lines.push(`[${i + 1}] (${l.confidence || 'media'}${l.pinned ? ', fijado' : ''}) ${l.insight || ''}`);
    if (l.evidence) lines.push(`    Evidencia: ${truncate(l.evidence, 260)}`);
    if (l.apply) lines.push(`    Aplicar: ${truncate(l.apply, 220)}`);
  });
  return `${lines.join('\n')}\n`;
}

function sourcesBlock(search) {
  if (!search || (!search.results?.length && !search.pages?.length)) {
    return '\nFUENTES: no hay resultados de búsqueda disponibles. Trabajá con conocimiento general y marcá todos los supuestos. No inventes URLs.\n';
  }
  const lines = ['\nFUENTES DE BÚSQUEDA (usar solo lo relevante; no copiar literal):'];
  (search.results || []).slice(0, 14).forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title || 'Sin título'} ”” ${r.url}`);
    if (r.snippet) lines.push(`    ${truncate(r.snippet, 320)}`);
  });
  if (search.pages?.length) {
    lines.push('\nCONTENIDO DE PÃGINAS (extractos):');
    search.pages.slice(0, 5).forEach((p, i) => {
      lines.push(`[P${i + 1}] ${p.title || ''} ”” ${p.url}`);
      lines.push(truncate(p.content, 1600));
    });
  }
  return `${lines.join('\n')}\n`;
}

/* Lista compacta y completa de los compradores ya verificados. Sin esto,
   los pasos largos reciben el JSON recortado del paso anterior y el red team
   puede afirmar (como pasó en una prueba real) que "no hay compradores" cuando
   la misión verificó 12. */
function verifiedBuyersBlock(ctx) {
  const buyers = (ctx.artifacts?.prospecting?.compradores || []).filter((buyer) => buyer && buyer.verificado !== false);
  if (!buyers.length) {
    return '\nCOMPRADORES VERIFICADOS: ninguno. No escribas mensajes ni supongas compradores que no están en esta lista.\n';
  }
  const lines = [`\nCOMPRADORES VERIFICADOS (${buyers.length}); esta es la lista completa y real de la misión:`];
  buyers.forEach((buyer, index) => {
    const place = [buyer.ciudad, buyer.pais].filter(Boolean).join(', ');
    const email = buyer.email ? `${buyer.email} (${buyer.email_estado || 'publico'})` : 'sin email público verificado';
    const priority = buyer.prioridad || 'media';
    lines.push(`[${index + 1}] ${buyer.nombre || 'Sin nombre'}${place ? ` ”” ${place}` : ''} ”” ${buyer.web || 'sin sitio propio'} ”” ${email} ”” prioridad ${priority}`);
    if (buyer.por_que) lines.push(`    Encaje: ${truncate(buyer.por_que, 200)}`);
  });
  return `${lines.join('\n')}\n`;
}

function marketRulesBlock(ctx) {
  const buyers = (ctx.artifacts?.prospecting?.compradores || []).filter((b) => b && b.verificado !== false);
  const countries = [...new Set(buyers.map((b) => String(b.pais || '').trim()).filter(Boolean))];
  const missionMarkets = (ctx.mission?.markets || []).map((m) => String(m).trim()).filter(Boolean);
  const all = [...new Set([...countries, ...missionMarkets])];
  if (!all.length) return '\nREGLAS POR PAÍS: no hay países en la lista. Usá inglés profesional y directo.\n';
  return `\nREGLAS DE COPYWRITING POR PAÍS (OBLIGATORIO: cada mensaje debe respetar las reglas del país de su comprador):\n${all.map((c) => marketBlock(c)).join('\n')}\n`;
}

function contextBlock(ctx, { prior = [], search = false } = {}) {
  const parts = [brandBlock(ctx), productBlock(ctx), missionBlock(ctx), learningsBlock(ctx)];
  if (search) parts.push(sourcesBlock(ctx.search));
  for (const [key, max] of prior) {
    if (ctx.artifacts?.[key]) parts.push(jsonBlock(key.toUpperCase().replaceAll('_', ' '), ctx.artifacts[key], max));
  }
  return parts.join('\n');
}

/* ─────────────────────────────────────────────────────────────
   Pasos del pipeline
   ───────────────────────────────────────────────────────────── */

export const STEP_ORDER = [
  'brief', 'research', 'prospecting', 'enrichment', 'customs', 'pricing',
  'outreach', 'content', 'compliance', 'redteam', 'revision', 'synthesis', 'learning',
];

/* La prospección va inmediatamente después de la investigación: decide si la
   misión puede vender y necesita la cuota de búsqueda fresca. Aduanas y
   precios pueden trabajar con menos consultas sin frenar la venta. */
export const DEPTHS = {
  rapida: {
    label: 'Rápida',
    description: 'Lo esencial para salir a vender esta semana. 8 pasos, sin contenido ni red team.',
    steps: ['brief', 'research', 'prospecting', 'enrichment', 'customs', 'pricing', 'outreach', 'synthesis'],
    calls: 7,
    minutes: '2”“4',
  },
  estandar: {
    label: 'Estándar',
    description: 'El equipo completo: investigación, compradores, contactos, precios, mensajes, contenido, cumplimiento y crítica.',
    steps: ['brief', 'research', 'prospecting', 'enrichment', 'customs', 'pricing', 'outreach', 'content', 'compliance', 'redteam', 'synthesis', 'learning'],
    calls: 10,
    minutes: '4”“8',
  },
  profunda: {
    label: 'Profunda',
    description: 'Todo lo anterior más una revisión y corrección obligatoria después del red team.',
    steps: ['brief', 'research', 'prospecting', 'enrichment', 'customs', 'pricing', 'outreach', 'content', 'compliance', 'redteam', 'revision', 'synthesis', 'learning'],
    calls: 11,
    minutes: '6”“12',
  },
};

export const STEPS = {
  brief: {
    id: 'brief',
    agent: 'director',
    title: 'Brief y tesis comercial',
    short: 'A quién, con qué ángulo y por qué.',
    critical: true,
    search: false,
    temperature: 0.5,
    schemaHint: `{
  "tesis": "una frase que ordene toda la campaña",
  "propuesta_de_valor": "qué entiende el comprador en 10 segundos",
  "publico_primario": "quién compra, en qué contexto y por qué",
  "publicos_secundarios": ["..."],
  "paises": [{"pais":"","motivo":"","canal":"","dificultad":"baja|media|alta"}],
  "angulos": [{"angulo":"","prueba":"","uso":"venta|contenido|ambos"}],
  "riesgos": ["..."],
  "supuestos": ["..."],
  "preguntas_abiertas": ["..."],
  "criterio_de_exito": "métrica concreta a 30 días"
}`,
    prompt: (ctx) => `Tarea: escribir el brief comercial de este producto para lanzar una misión de venta.
${contextBlock(ctx)}
Pensá como director comercial de una marca pequeña de diseño. No escribas un plan genérico: tomá posición.
- Elegí un público primario concreto (no "amantes del diseño").
- Priorizá 3 países como máximo, con motivo comercial y canal de entrada.
- Proponé 3 ángulos distintos y una prueba para cada uno (material, proceso, luz, historia, precio).
- Identificá los riesgos reales de vender este objeto (frágil, eléctrico, pesado, precio alto, producción lenta).
- El criterio de éxito tiene que poder medirse en 30 días.
Devolvé este JSON:
${STEPS.brief.schemaHint}`,
  },

  research: {
    id: 'research',
    agent: 'mercado',
    title: 'Mercado y competencia',
    short: 'Qué se vende, a qué precio y por qué canal.',
    critical: true,
    search: true,
    pages: 3,
    temperature: 0.35,
    schemaHint: `{
  "panorama": "párrafo de 100-140 palabras con lo esencial",
  "tendencias": [{"tendencia":"","evidencia":"","fuente":""}],
  "competidores": [{"nombre":"","pais":"","precio":"","canal":"","fortaleza":"","hueco":""}],
  "demanda": {"senales":["..."],"temporadas":"","terminos":["..."]},
  "canales": [{"canal":"","por_que":"","esfuerzo":"bajo|medio|alto"}],
  "fuentes": [{"titulo":"","url":""}],
  "conclusion": "qué implica esto para nosotros"
}`,
    prompt: (ctx) => `Tarea: analizar el mercado real de este producto con las fuentes disponibles.
${contextBlock(ctx, { prior: [['brief', 2500]], search: true })}
- Distinguí tendencia de moda pasajera. Si no hay evidencia suficiente, decilo.
- Los competidores deben salir de las fuentes. Si no podés confirmar precio, escribí "sin dato".
- Traducí la investigación a decisiones: qué canal conviene, qué término usa el comprador, qué hueco existe.
- Máximo 5 competidores y 5 tendencias. Priorizá calidad sobre cantidad.
Devolvé este JSON:
${STEPS.research.schemaHint}`,
  },

  customs: {
    id: 'customs',
    agent: 'aduanas',
    title: 'Aduanas y logística',
    short: 'Aranceles, certificaciones y envío internacional.',
    critical: false,
    search: true,
    pages: 2,
    temperature: 0.25,
    schemaHint: `{
  "resumen": "qué hay que resolver antes del primer envío",
  "paises": [{
    "pais":"","codigo_hs":"","arancel_estimado":"","impuestos":"",
    "requisitos":["..."],"etiquetado":"","certificaciones":[""],
    "incoterm":"","courier":"","riesgo":"bajo|medio|alto","notas":"","fuente":""
  }],
  "documentos": ["..."],
  "advertencia": "aclaración de que es orientativo"
}`,
    prompt: (ctx) => `Tarea: preparar una guía operativa de importación para los mercados de la misión.
${contextBlock(ctx, { prior: [['brief', 1800]], search: true })}
- Para cada país, estimá arancel y impuestos como rango y aclará que depende del código HS y del valor declarado.
- Sugerí un código HS probable para "lámparas eléctricas decorativas" y aclará que debe confirmarlo un despachante.
- Mencioná certificaciones reales según el país cuando las conozcas (CE/UKCA, FCC/UL, RoHS). Si no estás seguro, decilo.
- Incluí etiquetado, documentación, incoterm sugerido y un courier que opere en ese destino.
- No des consejo legal definitivo. La advertencia es obligatoria.
- Si un pais no aparece en las fuentes, deja la fuente vacia, escribe en notas que es una hipotesis y no inventes URLs.
Devolvé este JSON:
${STEPS.customs.schemaHint}`,
  },

  pricing: {
    id: 'pricing',
    agent: 'precios',
    title: 'Precios y márgenes',
    short: 'Costo aterrizado, precio directo, mayorista y galería.',
    critical: true,
    search: false,
    temperature: 0.25,
    schemaHint: `{
  "moneda": "",
  "supuestos": ["..."],
  "costos": {"materiales":0,"mano_obra":0,"packaging":0,"envio_local":0,"otros":0},
  "escenarios": [{"canal":"Directo","precio":0,"comision_pct":0,"envio":0,"ganancia":0,"margen_pct":0,"notas":""}],
  "psicologia": "",
  "descuentos": [{"tipo":"","condicion":"","limite":""}],
  "landed_cost": [{"pais":"","costo":0,"supuestos":""}],
  "recomendacion": "",
  "advertencia": ""
}`,
    prompt: (ctx) => `Tarea: construir la estructura de precios de este producto.
${contextBlock(ctx, { prior: [['brief', 2000], ['research', 3500], ['customs', 3500]] })}
- Si el producto no trae costo, estimá un costo de producción coherente con una lámpara impresa en 3D y marcá cada supuesto.
- Calculá al menos tres escenarios: venta directa online, mayorista y galería/interiorista. Usá la moneda de la marca.
- Mostrá ganancia y margen después de comisiones y envío, no solo el precio de lista.
- Incluá costo aterrizado por país usando los aranceles estimados; si falta un dato, usá un rango y explicá.
- Proponé un precio psicológico (ej. 189 en vez de 195) y una polÃtica de descuentos que no destruya el margen.
- La recomendación tiene que ser una sola decisión clara.
Devolvé este JSON:
${STEPS.pricing.schemaHint}`,
  },

  prospecting: {
    id: 'prospecting',
    agent: 'cazador',
    title: 'Compradores concretos',
    short: 'Tiendas, distribuidores y estudios con nombre y apellido.',
    critical: false,
    search: true,
    pages: 2,
    temperature: 0.35,
    schemaHint: `{
  "segmentos": [{"segmento":"","por_que":"","donde_buscar":["..."],"volumen":"bajo|medio|alto"}],
  "compradores": [{
    "nombre":"","tipo":"tienda|distribuidor|interiorista|hotel|galeria|marketplace|concept store",
    "pais":"","ciudad":"","web":"","contacto":"","rol":"",
    "email":"","email_estado":"desconocido|publico|verificado|probable",
    "por_que":"","angulo":"","prioridad":"alta|media|baja","origen":"fuentes|conocimiento","fuente":""
  }],
  "canales": [{"canal":"","como":"","esfuerzo":"bajo|medio|alto","retorno":"bajo|medio|alto"}],
  "proximos_pasos": ["..."],
  "faltantes": ["..."]
}`,
    prompt: (ctx) => `Tarea: encontrar compradores reales para este producto.
${contextBlock(ctx, { prior: [['brief', 2200], ['research', 3000]], search: true })}
- Cada comprador debe ser una tienda, distribuidor, estudio, galería, hotel o concept store real que hoy compre objetos de diseño de varias marcas y tenga local o e-commerce propio.
- Para cada uno: nombre comercial exacto, ciudad, país y sitio web oficial (campo "web", URL completa). Si no tenés el sitio, no lo incluyas.
- Si el comprador sale de las fuentes, completá "origen":"fuentes" y "fuente" con la URL exacta de la fuente.
- Si las fuentes no alcanzan, podés proponer tiendas reales que conozcas con su sitio oficial, con "origen":"conocimiento". El sistema verifica que el sitio exista y que mencione la tienda; si no coincide, se descarta.
- No incluyas fabricantes de lámparas (Vibia, Marset, Santa & Cole, Artemide, etc.): son competencia, no compradores. No incluyas marketplaces de comparación (idealo, Amazon, eBay), ni directorios, ferias, blogs ni notas de prensa.
- No inventes emails. Dejalos vacíos: el sistema busca el correo público en el sitio y descarta los que no aparecen. No inventes direcciones.
- Priorizá 8 a 12 compradores. Si solo hay 3 verificables, entregá 3: nunca rellenes con categorías genéricas.
- Incluá una sección de segmentos con buscadores o directorios concretos para ampliar la lista.
- Si las fuentes son insuficientes, decilo en "faltantes" y proponé cómo conseguir más.
Devolvé este JSON:
${STEPS.prospecting.schemaHint}`,
  },

  enrichment: {
    id: 'enrichment',
    agent: 'cazador',
    title: 'Verificación de contactos',
    short: 'Busca emails publicados y verifica dominios. No inventa direcciones.',
    critical: false,
    search: false,
    tool: true,
  },

  outreach: {
    id: 'outreach',
    agent: 'redactor',
    title: 'Mensajes de apertura',
    short: 'Secuencia breve y personalizada por comprador.',
    critical: true,
    search: false,
    temperature: 0.7,
    schemaHint: `{
  "estrategia": "",
  "secuencia": [{"paso":1,"dia":0,"objetivo":"","asunto":"","cuerpo":""}],
  "mensajes": [{"comprador":"","pais":"","idioma":"es|en","asunto":"","cuerpo":"","personalizacion":"","cta":""}],
  "whatsapp": [{"comprador":"","mensaje":""}],
  "objeciones": [{"objecion":"","respuesta":""}],
  "firma": "",
  "reglas": ["..."]
}`,
    prompt: (ctx) => `Tarea: escribir la secuencia de contacto y los mensajes personalizados.
${contextBlock(ctx, { prior: [['brief', 3000], ['research', 3000], ['pricing', 3000], ['prospecting', 12000]] })}
${marketRulesBlock(ctx)}
${verifiedBuyersBlock(ctx)}
- Escribí UN mensaje por cada comprador de PROSPECTING, con el campo "comprador" copiado exactamente como aparece en la lista. No omitas ninguno y no reutilices el mismo cuerpo para dos compradores.
- Si PROSPECTING no trae compradores, devolvé "mensajes": [] y explicá en "estrategia" qué falta para tener la lista. No escribas mensajes para compradores que no existen.
- Si no tenés un dato específico de una tienda, escribí un mensaje más breve y honesto, pero seguí siendo 1:1. Nunca uses el mensaje de otro comprador como relleno.
- Asunto de máximo 60 caracteres, sin mayúsculas gritadas ni emojis.
- Cuerpo de 65 a 110 palabras: presentación, encaje para este comprador y una oferta de valor comprobable. Un solo pedido concreto al final.
- Nada de "espero que estés bien", "soy un apasionado", "revolucionario" ni listas de features.
- Presentación limpia: 'Soy [nombre del responsable], de LUCIAN.' Nunca 'de LUCIAN (Caseros)' ni 'desde Caseros' por iniciativa del modelo; la ciudad postal, si es obligatoria, va sólo en el pie legal.
- No traslades al comprador discusiones internas del equipo sobre falta de fotos, importación, flete, costos inciertos o autoría. Si faltan elementos para ofrecer la pieza, señalá el bloqueo en el plan interno en vez de redactar una disculpa comercial.
- Personalizá solamente con un hecho verificable y citá su URL en el campo personalizacion. Si la fuente no demuestra una marca o colección, hablá del tipo de negocio y no inventes afinidades.
- IDIOMA OBLIGATORIO POR COMPRADOR: escribí cada mensaje EXACTAMENTE en el idioma indicado en el bloque de su país (ESPAÑOL / INGLÉS / PORTUGUÉS). España, Argentina, Chile, Uruguay, México y Colombia van en ESPAÑOL —aunque el comprador tenga un nombre o web en inglés, NO traduzcas el correo al inglés. Brasil va en PORTUGUÉS. Estados Unidos, Reino Unido y Alemania van en INGLÉS. Respetá también la variante local (vos/tú/usted) y el registro de cortesía de cada bloque.
- La secuencia base tiene 3 pasos: apertura (día 0), seguimiento con valor (día 4) y cierre amable (día 10), pero cualquier rechazo o respuesta detiene el contacto automático.
- CTA de interés, no reunión obligatoria: pedí permiso para mandar ficha real con medidas, materiales y opciones. No prometas adjuntos inexistentes.
- Ajustá la oferta al segmento: estudio/interiorista → especificaciones y personalización; hotel → series y tiempos sólo si constan; tienda → catálogo y condiciones mayoristas verificadas; galería → historia del objeto y terminaciones.
- Planteá en "estrategia" una hipótesis comercial comprobable por segmento (quién, beneficio concreto, objeción probable) y el resultado esperado medible en RESPUESTAS, no aperturas.
- Para WhatsApp, un mensaje de 35 palabras como máximo, sin archivos.
- Incluá 3 objeciones probables con respuestas honestas.
- No prometas ventas, certificaciones ni plazos que no estén en los datos.
- Respetá la recomendación de PRICING: si recomienda no abrir canal mayorista todavía, no ofrezcas precio mayorista ni pedido mínimo; presentá la pieza y pedí permiso para mandar la ficha.
- No afirmes qué marcas vende el comprador salvo que aparezcan en las fuentes o en su ficha; si no, usá un detalle seguro (ciudad o tipo de tienda). No inventes certificaciones, stock, plazos, precios ni resultados.
Devolvé este JSON:
${STEPS.outreach.schemaHint}`,
  },

  content: {
    id: 'content',
    agent: 'contenido',
    title: 'Contenido y narrativa',
    short: 'Siete días de piezas con gancho, guion y caption.',
    critical: false,
    search: false,
    temperature: 0.8,
    schemaHint: `{
  "pilares": [{"pilar":"","idea":""}],
  "calendario": [{"dia":"Día 1","plataforma":"","formato":"","gancho":"","guion":"","caption":"","hashtags":[""],"cta":""}],
  "ganchos": ["..."],
  "serie": {"nombre":"","descripcion":"","episodios":["..."]},
  "fotos": [{"toma":"","por_que":""}],
  "advertencia": ""
}`,
    prompt: (ctx) => `Tarea: diseñar el contenido de lanzamiento para redes.
${contextBlock(ctx, { prior: [['brief', 3000], ['research', 3000], ['pricing', 1800]] })}
${ctx.photos?.length ? '- Mirá las fotos adjuntas: describá ángulos, luz y detalles que se puedan usar. No inventes lo que no se ve.' : '- No hay fotos adjuntas: proponé tomas concretas para producirlas.'}
- El contenido tiene que vender el objeto y el proceso, no la marca en abstracto.
- 7 piezas máximo, una por día, mezclando Instagram, TikTok y Pinterest. Agregá LinkedIn solo si el ángulo es B2B.
- Cada pieza necesita un gancho de menos de 12 palabras y un guion de 3 a 5 líneas, no un párrafo.
- Evitá frases genéricas tipo "la magia de la luz". Buscá imágenes mentales concretas.
- Proponé una serie recurrente que se pueda sostener en el tiempo con poco esfuerzo.
- Los hashtags: 5 a 8, específicos, sin spam.
Devolvé este JSON:
${STEPS.content.schemaHint}`,
  },

  compliance: {
    id: 'compliance',
    agent: 'cumplimiento',
    title: 'Cumplimiento y reputación',
    short: 'Claims, privacidad, opt-out y promesas riesgosas.',
    critical: false,
    search: false,
    temperature: 0.2,
    schemaHint: `{
  "veredicto": "aprobado|con_cambios|rechazado",
  "riesgos": [{"nivel":"alto|medio|bajo","tema":"","detalle":"","arreglo":""}],
  "claims_a_evitar": ["..."],
  "email": {"base_legal":"","opt_out":"","datos_personales":""},
  "aduanas": ["..."],
  "correcciones": [{"campo":"mensaje|contenido","original":"cita literal","sugerido":""}],
  "checklist": [{"item":"","ok":true}]
}`,
    prompt: (ctx) => `Tarea: revisar el paquete comercial antes de que salga.
${contextBlock(ctx, { prior: [['brief', 1800], ['customs', 2200], ['pricing', 2200], ['outreach', 6500], ['content', 4500]] })}
${verifiedBuyersBlock(ctx)}
- Revisá afirmaciones verificables: materiales, origen, sustentabilidad, plazos, certificaciones, resultados.
- Revisá el contacto en frío: base legal, identificación del remitente, opt-out claro y datos personales. Mencioná GDPR si aplica a la UE y CAN-SPAM si aplica a EE. UU.
- Detectá mensajes que suenan a spam, promesas vacías o presión.
- Señalá riesgos de aduana que el plan esté ignorando.
- Proponé correcciones concretas, no consejos generales.
- Cada corrección debe citar LITERALMENTE el texto original y marcar si es de un mensaje a compradores ("campo": "mensaje") o del contenido ("campo": "contenido"). Solo las de mensaje se aplican al correo; las de contenido no deben bloquear un mensaje que no las contiene.
- Si algo no se puede verificar, el veredicto no puede ser "aprobado" sin una advertencia.
- Sé breve: máximo 6 riesgos, 4 correcciones y 1 frase por campo. No repitas el plan.
Devolvé este JSON:
${STEPS.compliance.schemaHint}`,
  },

  redteam: {
    id: 'redteam',
    agent: 'redteam',
    title: 'Red team',
    short: 'Los agujeros del plan, antes de que los encuentre el mercado.',
    critical: false,
    search: false,
    temperature: 0.55,
    schemaHint: `{
  "veredicto": "avanzar|ajustar|detener",
  "supuestos_fragiles": [{"supuesto":"","por_que_falla":"","prueba_barata":""}],
  "agujeros": [{"area":"precio|aduanas|mensaje|mercado|operacion","problema":"","impacto":"","arreglo":""}],
  "preguntas_dificiles": ["..."],
  "escenarios": [{"escenario":"","probabilidad":"baja|media|alta","plan_b":""}],
  "lo_que_sobra": ["..."],
  "sello": "una frase con el riesgo principal"
}`,
    prompt: (ctx) => `Tarea: romper el plan. Buscá por qué puede fallar antes de que falle.
${contextBlock(ctx, { prior: [['brief', 2500], ['research', 3000], ['customs', 3000], ['pricing', 3500], ['prospecting', 4500], ['outreach', 6000], ['content', 3500], ['compliance', 3000]] })}
${verifiedBuyersBlock(ctx)}
- No seas amable por compromiso. Si un número no cierra, mostrá la cuenta.
- Atacá supuestos de demanda, precio, margen, aduana, tiempos de producción y capacidad de una sola persona.
- Detectá mensajes que un comprador profesional borraría sin leer.
- Para cada agujero, proponé una prueba barata que se pueda hacer esta semana.
- Diferenciá "esto mata la misión" de "esto se corrige".
- Usá "detener" solo si el plan no se puede ejecutar de ninguna forma. Si el problema se corrige con una acción previa concreta (medir el costo, cotizar el flete, actualizar la ficha), el veredicto correcto es "ajustar", no "detener".
- Terminá con un veredicto honesto: avanzar, ajustar o detener.
- Sé breve: máximo 5 supuestos frágiles, 5 agujeros y 4 escenarios. Una frase por campo; no repitas el contexto.
Devolvé este JSON:
${STEPS.redteam.schemaHint}`,
  },

  revision: {
    id: 'revision',
    agent: 'director',
    title: 'Corrección post red team',
    short: 'Cambia lo que haya que cambiar y deja el plan defendible.',
    critical: false,
    search: false,
    temperature: 0.4,
    schemaHint: `{
  "cambios": [{"que":"","por_que":""}],
  "mensajes": [{"comprador":"","asunto":"","cuerpo":""}],
  "ajustes_plan": ["..."],
  "riesgos_que_quedan": ["..."]
}`,
    prompt: (ctx) => `Tarea: corregir el plan usando la crítica del red team.
${contextBlock(ctx, { prior: [['brief', 2000], ['pricing', 3000], ['outreach', 6000], ['compliance', 2500], ['redteam', 5000]] })}
- No defiendas lo indefendible. Si el red team encontró un error de margen o de aduana, corregilo.
- Mantené lo que sí funciona y explicá por qué.
- Reescribí solo los mensajes que lo necesiten. Si un mensaje queda igual, no lo repitas.
- Usá el campo "comprador" exactamente como aparece en OUTREACH. No mezcles el mensaje de una tienda con otra.
- Los ajustes tienen que ser acciones concretas, no principios.
- Nunca insertes la localidad de LUCIAN en el nombre o presentación del remitente ni conviertas riesgos internos (precio, flete, origen) en la apertura de venta.
Devolvé este JSON:
${STEPS.revision.schemaHint}`,
  },

  synthesis: {
    id: 'synthesis',
    agent: 'director',
    title: 'Plan final para el dueño',
    short: 'Qué hacer los próximos 7 días, en orden.',
    critical: true,
    search: false,
    temperature: 0.45,
    schemaHint: `{
  "decision": "una sola frase: qué hacemos",
  "tesis": "",
  "plan_7_dias": [{"dia":1,"accion":"","resultado":"","tiempo":"30 min"}],
  "prioridades": [{"prioridad":1,"accion":"","por_que":"","metrica":""}],
  "mensajes_listos": [{"comprador":"","asunto":"","cuerpo":""}],
  "presupuesto": {"inversion":0,"detalle":"","retorno_esperado":""},
  "metricas": [{"metrica":"","meta":"","cuando":""}],
  "no_hacer": ["..."],
  "resumen": "máximo 120 palabras para el dueño"
}`,
    prompt: (ctx) => `Tarea: escribir el plan final que el dueño va a ejecutar.
${contextBlock(ctx, { prior: [['brief', 2500], ['research', 3000], ['customs', 3000], ['pricing', 3500], ['prospecting', 5000], ['outreach', 6000], ['content', 3500], ['compliance', 3000], ['redteam', 5000], ['revision', 5000]] })}
${verifiedBuyersBlock(ctx)}
- El plan de 7 días tiene que ser realista para una persona sola: máximo 3 horas por día.
- Cada día tiene una sola acción principal, un resultado esperado y un tiempo estimado.
- Priorizá lo que genera conversaciones esta semana, no lo que se ve lindo en un tablero.
- Incluí los mensajes comercialmente aptos para revisión, con asunto y cuerpo, corregidos según compliance y red team.
- No agregues una ciudad al nombre de LUCIAN (por ejemplo, 'LUCIAN (Caseros)'); no insertes problemas internos de costos o fletes ni atribuciones de diseño no verificadas.
- El presupuesto tiene que ser concreto: cuánto y en qué. Si no hace falta gastar, decilo.
- "No hacer" es tan importante como el plan: qué distracción evitar.
- El resumen es para el dueño, en 120 palabras, sin jerga.
Devolvé este JSON:
${STEPS.synthesis.schemaHint}`,
  },

  learning: {
    id: 'learning',
    agent: 'memoria',
    title: 'Aprendizajes',
    short: 'Lo que esta misión enseñó para la próxima.',
    critical: false,
    search: false,
    temperature: 0.35,
    schemaHint: `{"aprendizajes":[{"insight":"","evidencia":"","confianza":"alta|media|baja","aplicar":"","etiqueta":"precio|mensaje|mercado|aduanas|operacion"}]}`,
    prompt: (ctx) => `Tarea: extraer aprendizajes útiles de esta misión.
${contextBlock(ctx, { prior: [['brief', 2000], ['research', 2500], ['pricing', 2500], ['prospecting', 3500], ['outreach', 4000], ['redteam', 3500], ['synthesis', 4000]] })}
- Solo 3 a 5 aprendizajes. Nada obvio ("hay que investigar el mercado").
- Cada uno necesita evidencia de esta misión, no una opinión.
- La confianza tiene que ser honesta: alta solo si hay datos, media si es una señal, baja si es una hipótesis.
- El campo "aplicar" dice qué hacer distinto en la próxima misión.
Devolvé este JSON:
${STEPS.learning.schemaHint}`,
  },
};

export const PIPELINE_STEPS = STEP_ORDER.map((id) => STEPS[id]).filter(Boolean);

/* ─────────────────────────────────────────────────────────────
   Prompts fuera del pipeline: respuestas y consultas al equipo
   ───────────────────────────────────────────────────────────── */

export function replyPrompt(thread, product, brand) {
  const messages = (thread.messages || []).slice(-8).map((m) => ({
    de: m.direction === 'in' ? 'comprador' : 'nosotros',
    asunto: m.subject,
    texto: truncate(m.body, 1800),
    fecha: m.at,
  }));
  return `Tarea: analizar la respuesta de un comprador y proponer el siguiente movimiento.
${jsonBlock('MARCA', { nombre: brand?.name, propuesta: brand?.tagline, web: brand?.website }, 800)}
${jsonBlock('PRODUCTO', { nombre: product?.name, precio: product?.price, moneda: product?.currency, descripcion: truncate(product?.description, 900) }, 1200)}
${jsonBlock('CONTACTO', thread.contact, 1200)}
${marketBlock(thread.contact?.country || '')}
${jsonBlock('CONVERSACIÓN', messages, 5000)}
${jsonBlock('NOTAS INTERNAS', thread.notes, 1000)}
- Detectá la intención real, no solo la cortesía.
- El score va de 0 a 100: 0 es "no contactar más", 100 es "quiere comprar ya".
- El borrador de respuesta tiene que ser breve (70-110 palabras), resolver la objeción y proponer un solo paso.
- Si la respuesta es un rebote o un no, el borrador debe cerrar con dignidad y dejar la puerta abierta sin insistir.
- No inventes disponibilidad, plazos ni precios que no estén en los datos.
Devolvé este JSON:
{
  "intencion": "interesado|pide_precio|pide_muestra|objecion|derivacion|no_ahora|no_gracias|rebote|fuera_de_oficina|desconocida",
  "sentimiento": "positivo|neutral|negativo",
  "score": 0,
  "senales": ["..."],
  "siguiente_paso": "",
  "etapa": "respondio|interesado|negociando|ganado|perdido|contactado",
  "borrador": {"asunto":"","cuerpo":""},
  "nota": ""
}`;
}

export function askPrompt(agentId, question, context, options = {}) {
  const agent = getAgent(agentId);
  const history = Array.isArray(options?.history) ? options.history : [];
  const channel = options?.channel || 'web';
  const historyBlock = history.length
    ? `CONVERSACION RECIENTE (ultimos turnos):\n${history.map((h) => `${h.role === 'user' ? 'Dueño' : 'Agente'}: ${String(h.text || '').slice(0, 600)}`).join('\n')}\n`
    : '';
  if (channel === 'telegram') {
    return `Tarea: sos el agente personal del dueño por Telegram. Mantené el hilo; usá el historial para "eso", "el anterior", "más corto".
Sos un agente de IA completo y autónomo, no un bot de comandos. Podés responder cualquier pregunta, analizar datos, diseñar estrategias, investigar en la web, redactar contenido, preparar borradores, cotizar, actualizar hilos/productos, lanzar misiones y ejecutar cualquier tarea del negocio. Actuás como socio operativo: razonás, proponés y ejecutás; lo irreversible (enviar mails, lanzar misiones, cambiar precios) lo dejás para confirmación del dueño.
Si recibís una imagen, describila y usala para el pedido (producto, comprador, documento). Si recibís un audio, lo transcribí y respondé en consecuencia.
${jsonBlock('CONTEXTO DEL NEGOCIO', context, 8000)}
${historyBlock}
PREGUNTA DEL DUEÑO:
${truncate(question, 2500)}
REGLAS:
- Respondé la pregunta completa, no te limites a una lista de acciones. Si el dueño pide algo que no existe como función, resolvé la parte que sí podés y explicá cómo completar el resto.
- Nunca empieces con "no puedo". Siempre ofrecé un camino real y ejecutá lo que esté a tu alcance.
- Si la acción es externa/irreversible, devolvé un bloque JSON de acción; el sistema pide confirmación.
- No inventes datos; marcá "supuesto". Si usaste buscar, citá las URLs de las fuentes.
- Herramientas que podés invocar cuando haga falta: buscar, crear_borrador, actualizar_hilo, guardar_aprendizaje, agendar_seguimiento, enviar_borrador, lanzar_mision, actualizar_producto, cotizar, analizar_hilo, generar_contenido, investigar. Pero no sos un menú: razoná primero y usá la herramienta solo si ayuda.
- Incluí el bloque accion solo si el usuario pide hacer algo; en ese caso poné requiere_accion: true.
- Español rioplatense, texto plano, <=600 palabras; si es una solución larga, pasos numerados y la acción concreta al final.
- Tono: cercano y directo, como un socio; sin "estimado", sin relleno, sin repetir la pregunta.
- Formato de acción: {"accion":{"tipo":"...","args":{...},"resumen":"...","requiere_accion":true}}
- Máximo 1800 tokens.`;
  }
  return `Tarea: responder una consulta del dueño como ${agent.name}.
${jsonBlock('CONTEXTO DEL NEGOCIO', context, 8000)}
${historyBlock}
PREGUNTA DEL DUEÑO:
${truncate(question, 2500)}
- Respondé en texto plano, en español rioplatense, con párrafos cortos y, si ayuda, una lista.
- Sé concreto y útil. Si falta un dato, decí qué dato falta y cómo conseguirlo.
- No inventes resultados de ventas ni cifras que no estén en el contexto.
- No repitas la pregunta. Empezá directo con la respuesta.
- Máximo 350 palabras.`;
}
