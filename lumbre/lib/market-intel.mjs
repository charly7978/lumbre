/* ============================================================
   Inteligencia comercial por país / mercado.
   Reglas de idioma, tono, cortesía y persuasión para que cada
   correo se sienta escrito por alguien de ese mercado, no por
   un generador global. Se inyecta en el prompt de "outreach".
   ============================================================ */

export const MARKETS = {
  argentina: {
    idioma: 'es',
    variante: 'español rioplatense (vos, tenés, querés)',
    tono: 'Cercano, directo, con confianza. Se valora la honestidad y el trato de igual a igual; nada de formalismos excesivos ni venta agresiva.',
    cortesia: 'Tratá de "vos". Un "hola, [nombre]" y una despedida simple funcionan mejor que "estimado/a señor/a".',
    apertura: 'Mencioná un detalle concreto del local o de su ciudad y conectalo con la pieza. Ejemplo: "Vi que en Palermo trabajan con luz cálida…".',
    cta: 'Pedí permiso para mandar la ficha con precio: "¿Te paso la ficha con precio mayorista?". El "¿te interesa?" directo funciona.',
    cierres: ['Quedo a disposición', 'Un saludo', 'Abrazo'],
    evitar: ['Usted', 'Estimado señor', 'Aprovecho la oportunidad', 'Sinceramente'],
    moneda: 'ARS',
  },
  chile: {
    idioma: 'es',
    variante: 'español chileno (tú, tienes, quisiera)',
    tono: 'Cordial y respetuoso, sin excesiva informalidad. Se aprecia la claridad y el profesionalismo moderado.',
    cortesia: 'Usá "tú" en un registro neutro. "Hola [nombre]" + una frase de cortesía breve. Evitá el "vos".',
    apertura: 'Conectá el proyecto o el barrio de la tienda con la lámpara. Los chilenos valoran que se note interés real por su negocio.',
    cta: 'Pedí permiso con tono suave: "¿Le gustaría que le envíe la ficha técnica y valores?".',
    cierres: ['Un saludo cordial', 'Quedo atento', 'Saludos'],
    evitar: ['Vos', 'Cheta', 'Demasiada cercanía', 'Urgencia falsa'],
    moneda: 'CLP',
  },
  uruguay: {
    idioma: 'es',
    variante: 'español rioplatense (vos, tenés, querés)',
    tono: 'Muy parecido al argentino pero algo más pausado y menos efusivo. Directo, honesto, sin presión.',
    cortesia: 'Tratá de "vos". "Hola [nombre], espero que andes bien" es aceptable si es breve.',
    apertura: 'Mencioná el local, su estilo o algo concreto de Montevideo. La sutileza funciona mejor que la grandilocuencia.',
    cta: '"¿Te mando la ficha con precio para que la veas con calma?" funciona bien: da espacio, no apura.',
    cierres: ['Saludos', 'Un abrazo', 'Quedo a disposición'],
    evitar: ['Presión', 'Superlativos', 'Usted'],
    moneda: 'UYU',
  },
  mexico: {
    idioma: 'es',
    variante: 'español neutro de México (usted o tú según canal; en B2B se prefiere "usted" al inicio)',
    tono: 'Cordial, respetuoso y cálido. La cortesía importa: se valora el trato atento y la presentación profesional.',
    cortesia: 'En el primer correo usá "usted" y "Estimado/a [Nombre]". Pasado el primer intercambio, si la otra persona tutea, se puede pasar a "tú".',
    apertura: 'Reconocé el proyecto o la trayectoria del estudio con respeto. Evitá assumptions: usá datos verificables del sitio.',
    cta: 'Pedí permiso de forma educada: "¿Me permite compartirle la ficha técnica con precios?".',
    cierres: ['Quedo a su disposición', 'Atentamente', 'Un cordial saludo'],
    evitar: ['Vos', 'Demasiada informalidad en el primer contacto', 'Apodos', 'Presión directa'],
    moneda: 'MXN',
  },
  colombia: {
    idioma: 'es',
    variante: 'español neutro de Colombia (usted al inicio, tú después)',
    tono: 'Amable y conversacional. Se valora la calidez sin perder profesionalismo.',
    cortesia: 'Usá "usted" inicialmente con "Estimado/a [Nombre]". Un tono amable y agradecido genera confianza.',
    apertura: 'Mencioná algo positivo y concreto del negocio, con admiración genuina pero breve.',
    cta: '"¿Le gustaría recibir la ficha y una propuesta para su espacio?" — invitación, no exigencia.',
    cierres: ['Quedo atento/a', 'Un saludo cordial', 'Gracias de antemano'],
    evitar: ['Sequedad excesiva', 'Vos', 'Presión'],
    moneda: 'COP',
  },
  espana: {
    idioma: 'es',
    variante: 'español de España (tú, tienes)',
    tono: 'Directo, con sentido del humor sutil y mucho respeto por el tiempo. Se premia la concreción y el "menos es más". Nada de halagos vacíos.',
    cortesia: '"Hola [nombre]" y al grano. El "estimado/a" se siente anticuado en B2B creativo.',
    apertura: 'Entrá directo al detalle que viste de su tienda y a qué pieza encaja. Sin rodeos.',
    cta: 'Pedí algo concreto y fácil de responder: "¿Te paso ficha y precio mayorista?".',
    cierres: ['Un saludo', 'Gracias', 'Nos leemos'],
    evitar: ['Usted', 'Halagos genéricos', 'Lenguaje demasiado formal', 'Promesas'],
    moneda: 'EUR',
  },
  'estados unidos': {
    idioma: 'en',
    variante: 'US English, direct but warm',
    tono: 'Confident, concise, specific. Lead with the value and the evidence; avoid hype. American B2B buyers skim, so the first line must earn the second.',
    cortesia: 'Use "Hi [First name]," and a clean sign-off. Skip "Dear Sir/Madam". Match their level of formality after the first reply.',
    apertura: 'Name one specific, verifiable detail about their store or collection, then connect it to the piece. Never invent a brand they carry.',
    cta: 'One low-friction ask: "Would you like me to send the spec sheet with wholesale pricing?"',
    cierres: ['Best', 'Thanks', 'Looking forward', 'Best regards'],
    evitar: ['Hope this finds you well', 'Excited to announce', 'Revolutionary', 'Revolutionize', 'Just checking in', 'Circle back'],
    moneda: 'USD',
  },
  'reino unido': {
    idioma: 'en',
    variante: 'British English, understated and polite',
    tono: 'Restrained, polite, lightly formal. Understatement lands better than enthusiasm. Avoid superlatives and hard sells.',
    cortesia: 'Use "Hello [Name]," or "Dear [Name],". A polite, slightly reserved tone is expected.',
    apertura: 'A specific observation about their shop, phrased modestly. Avoid grand claims.',
    cta: 'Soft ask: "Would it be helpful if I sent over the spec sheet and trade pricing?"',
    cierres: ['Kind regards', 'Best wishes', 'Many thanks'],
    evitar: ['Overhyping', 'Hard sell', 'US slang', 'Too casual'],
    moneda: 'GBP',
  },
  alemania: {
    idioma: 'en',
    variante: 'English (German business culture: precise, evidence-first)',
    tono: 'Sachlich, präzise, faktenbasiert. Even in English, German buyers expect data, clarity and zero fluff. Claims need proof.',
    cortesia: 'Use "Dear [Name]," and stay formal. Get to the point quickly.',
    apertura: 'Lead with a factual observation and the relevant specification. Skip small talk.',
    cta: 'Concrete, factual ask: "I can send the technical sheet and wholesale terms on request."',
    cierres: ['Kind regards', 'Best regards'],
    evitar: ['Small talk', 'Exaggeration', 'Vague claims', 'Unverified certifications'],
    moneda: 'EUR',
  },
  brasil: {
    idioma: 'pt',
    variante: 'Português brasileiro (você, profissional e caloroso)',
    tono: 'Warm, friendly and professional. Brazilians appreciate genuine enthusiasm and personal connection, but still want concrete information.',
    cortesia: 'Use "Olá, [Nome]," and "você". A warm, respectful tone works well.',
    apertura: 'Mention something specific and positive about their store, then connect it to the piece.',
    cta: 'Warm ask: "Posso te enviar a ficha técnica com preços para revenda?"',
    cierres: ['Um abraço', 'Atenciosamente', 'Obrigado/a'],
    evitar: ['Frieza excessiva', 'Promessas', 'Uso de "tu" (soa estranho em SP)'],
    moneda: 'BRL',
  },
  portugal: {
    idioma: 'pt',
    variante: 'Português europeu (formal, "exmo/a Sr/a" ou "Olá [Nome]" conforme contexto)',
    tono: 'Formal but not stiff. Politeness and correct language matter; avoid Brazilian expressions.',
    cortesia: 'Prefer "Exmo/a Sr./Sra. [Nome]" in a first formal approach, or "Olá [Nome]" for creative studios.',
    apertura: 'A respectful, specific observation about their space.',
    cta: '"Gostaria de lhe enviar a ficha técnica e condições de revenda?"',
    cierres: ['Com os melhores cumprimentos', 'Atenciosamente'],
    evitar: ['Expressões brasileiras', 'Informalidade excessiva', 'Exageros'],
    moneda: 'EUR',
  },
};

/** Normaliza un nombre de país a una clave del mapa. */
export function marketKey(country = '') {
  const raw = String(country || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/argentin/.test(raw)) return 'argentina';
  if (/chil/.test(raw)) return 'chile';
  if (/urugu/.test(raw)) return 'uruguay';
  if (/mexic/.test(raw)) return 'mexico';
  if (/colomb/.test(raw)) return 'colombia';
  if (/espan|spain/.test(raw)) return 'espana';
  if (/estados unidos|united states|usa|\busa\b|\bu\.s/.test(raw)) return 'estados unidos';
  if (/reino unido|united kingdom|\buk\b|inglaterra/.test(raw)) return 'reino unido';
  if (/aleman|german/.test(raw)) return 'alemania';
  if (/brasil|brazil/.test(raw)) return 'brasil';
  if (/portugal/.test(raw)) return 'portugal';
  return null;
}

/** Devuelve el bloque de inteligencia de mercado para inyectar al prompt. */
export function marketBlock(country = '') {
  const key = marketKey(country);
  const m = key ? MARKETS[key] : null;
  if (!m) {
    return `\nMERCADO: ${country || 'no especificado'}\n- País sin reglas específicas: escribí en inglés profesional, claro y directo, con un detalle verificable del comprador.\n`;
  }
  return `
MERCADO: ${country} (${m.variante})
- Idioma de salida: ${m.idioma === 'en' ? 'INGLÉS' : m.idioma === 'pt' ? 'PORTUGUÉS' : 'ESPAÑOL'} (${m.variante}).
- Tono: ${m.tono}
- Cortesía: ${m.cortesia}
- Apertura: ${m.apertura}
- Cierre / petición (CTA): ${m.cta}
- Firmas sugeridas: ${m.cierres.join(' · ')}.
- Evitá explícitamente: ${m.evitar.join(' · ')}.
- Moneda/local: ${m.moneda} (si citás precios, usá esta moneda y formato local).
`;
}

/** Instrucción global de calidad comercial (se suma a COMMON_RULES). */
export const COPYWRITING_RULES = `
REGLAS DE COPIWRITING COMERCIAL (aplican a TODOS los mensajes):
- Un solo objetivo por correo: conseguir una respuesta, no contar toda la historia.
- La primera línea debe comunicar un encaje comercial concreto. Si no tenés un dato verificable del comprador, presentá la pieza brevemente sin inventar afinidades ni pedir permiso para presentarte. NUNCA inventes una marca, un proyecto o un halago genérico.
- Estructura recomendada: (1) detalle concreto del comprador, (2) una frase de valor tuyo conectada a ese detalle, (3) prueba breve (material, proceso, plazo real), (4) una sola pregunta fácil de responder.
- Escribí como persona, no como catálogo: vos/tú/uстed según el mercado, sin "nosotros" corporativo.
- Nada de adjetivos vacíos ("increíble", "revolucionario", "de alta calidad"). Mostralo con datos: material, medida, plazo, proceso.
- Sin urgencia falsa, sin "solo por hoy", sin "última oportunidad".
- El asunto promete exactamente lo que el correo entrega. Máximo 60 caracteres, sin mayúsculas gritadas ni emojis. Si el asunto es genérico ("Consulta", "Hola"), el correo se pierde: hacelo específico al comprador o a la pieza.
- Cuerpo: 65–110 palabras. El primer correo debe ser breve y fácil de leer desde el celular.
- La firma incluye nombre real, LUCIAN y su web, cuando esté configurada. La ubicación del vendedor no forma parte del nombre de la marca; nunca escribas 'LUCIAN (Caseros)' ni agregues ninguna localidad entre paréntesis.
- Respetá el paso de SEGUIMIENTO: el día 4 aportás algo nuevo (ficha, foto, plazo), no repitas el primer correo con otra palabra. El día 10 cerrás con gratitud y dejás la puerta abierta, sin culpa.
- Nunca inventes que el comprador respondió, que ya hablaron o que existe una cotización previa.
`;
