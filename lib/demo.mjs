import { addDays, nowISO, slugify, uid } from './util.mjs';
import { detectOptOut } from './email.mjs';

/* ─────────────────────────────────────────────────────────────
   Modo demo. Todo lo que genera está marcado como ejemplo y usa
   el dominio reservado example.com. Nunca se envía por accidente.
   ───────────────────────────────────────────────────────────── */

const DEMO_SOURCE = 'https://example.com/directorio-diseno';

function money(value, currency = 'USD') {
  return `${currency} ${Math.round(Number(value) || 0)}`;
}

function baseData(ctx) {
  const product = ctx.product || {};
  const price = Number(product.price) || 240;
  const currency = product.currency || ctx.settings?.mission?.currency || 'USD';
  const markets = (ctx.mission?.markets || ['España', 'México', 'Estados Unidos']).slice(0, 3);
  const cost = Number(product.cost) || Math.round(price * 0.24);
  return { product, price, currency, markets, cost };
}

function buyerList(product, markets, currency, price) {
  const names = [
    ['Luz de Autor', 'tienda', 'España', 'Madrid', 'concept store', 'https://example.com/luz-de-autor', 'compras@luz-de-autor.example.com', 'alta', 'Trabajan piezas de autor para departamentos pequeños; buscan lámparas con historia y buena luz.'],
    ['Casa Nórdica', 'tienda', 'México', 'Ciudad de México', 'diseño de interiores', 'https://example.com/casa-nordica', 'hola@casa-nordica.example.com', 'alta', 'Su cliente compra diseño accesible; tienen vidriera en Roma Norte y venden online.'],
    ['Studio Lumen', 'interiorista', 'Estados Unidos', 'Nueva York', 'estudio de interiorismo', 'https://example.com/studio-lumen', 'hello@studio-lumen.example.com', 'alta', 'Proyectos residenciales de alto ticket; necesitan piezas statement y cumplimiento UL.'],
    ['Atelier Bruma', 'galeria', 'Francia', 'París', 'galería de objetos', 'https://example.com/atelier-bruma', '', 'media', 'Mezclan objetos de autor con arte; el precio no es el primer filtro, la historia sí.'],
    ['Forma Living', 'tienda', 'España', 'Barcelona', 'mobiliario y luz', 'https://example.com/forma-living', 'info@forma-living.example.com', 'alta', 'Ya venden lámparas de diseñadores emergentes; buscan exclusividad por zona.'],
    ['Habitar', 'distribuidor', 'Argentina', 'Buenos Aires', 'distribución de diseño', 'https://example.com/habitar', 'ventas@habitar.example.com', 'media', 'Distribuyen marcas locales en tiendas de todo el país; pueden probar una serie corta.'],
    ['Nord & Light', 'tienda', 'Dinamarca', 'Copenhague', 'iluminación', 'https://example.com/nord-light', 'buy@nord-light.example.com', 'media', 'Surtido muy curado; exigen documentación de materiales y packaging sin plástico.'],
    ['Objeto Casa', 'tienda', 'Colombia', 'Bogotá', 'concept store', 'https://example.com/objeto-casa', 'contacto@objeto-casa.example.com', 'alta', 'Público joven con interés en diseño latinoamericano; buen canal de entrada regional.'],
    ['The Design Edit', 'marketplace', 'Reino Unido', 'Londres', 'marketplace de diseño', 'https://example.com/the-design-edit', 'sellers@the-design-edit.example.com', 'media', 'Curaduría editorial y venta online; piden fichas técnicas completas.'],
    ['Mesa Alta', 'interiorista', 'Estados Unidos', 'Miami', 'estudio de arquitectura', 'https://example.com/mesa-alta', 'studio@mesa-alta.example.com', 'media', 'Proyectos de hospitality; pueden pedir 20 unidades para un hotel boutique.'],
    ['Casa Flora', 'concept store', 'Portugal', 'Lisboa', 'concept store', 'https://example.com/casa-flora', 'ola@casa-flora.example.com', 'baja', 'Mezcla cerámica, textiles y luz; entrada más lenta pero afinidad estética alta.'],
    ['Hotel Alba', 'hotel', 'España', 'Menorca', 'hotel boutique', 'https://example.com/hotel-alba', '', 'baja', 'Reforma de 18 habitaciones; necesitan lámparas resistentes y repetibles.'],
  ];
  return names.map(([nombre, tipo, pais, ciudad, rol, web, email, prioridad, por_que], index) => ({
    nombre,
    tipo,
    pais: markets.includes(pais) ? pais : (index < 4 ? markets[index % markets.length] : pais),
    ciudad,
    web,
    contacto: rol,
    rol,
    email,
    email_estado: email ? 'publico' : 'desconocido',
    por_que,
    angulo: index % 2 === 0
      ? `Una pieza de ${product.name || 'luz'} con geometría propia, ideal para espacios donde la lámpara se ve de cerca.`
      : `Serie corta y personalizable en color para probar en vidriera sin inmovilizar stock.`,
    prioridad,
    fuente: DEMO_SOURCE,
    demo: true,
    precio_sugerido: money(Number(currency === 'USD' ? price * 1.6 : price) || price, currency),
  }));
}

/* ─────────────────────────────────────────────────────────────
   Salidas por paso
   ───────────────────────────────────────────────────────────── */

export function demoStep(stepId, ctx) {
  const { product, price, currency, markets, cost } = baseData(ctx);
  const name = product.name || 'Aurora 01';
  const code = product.code || 'AUR-01';
  const country1 = markets[0] || 'España';
  const country2 = markets[1] || 'México';
  const country3 = markets[2] || 'Estados Unidos';

  if (stepId === 'brief') {
    return {
      tesis: `Vender ${name} como una pieza de luz escultórica para espacios pequeños, no como una lámpara decorativa más.`,
      propuesta_de_valor: `Una lámpara de autor impresa en 3D, con geometría propia, luz cálida y producción en series cortas. Se puede personalizar el color y el largo del cable sin cambiar el diseño.`,
      publico_primario: `Dueños de tiendas de diseño y estudios de interiorismo que buscan piezas con relato para clientes de departamentos de 40 a 80 m².`,
      publicos_secundarios: [
        'Hoteles boutique en reforma que necesitan 10 a 30 unidades repetibles.',
        'Compradores directos que ya invirtieron en muebles de diseño y buscan una lámpara que no se vea en cualquier lado.',
        'Arquitectos que necesitan una pieza statement para un hall o un comedor.',
      ],
      paises: [
        { pais: country1, motivo: 'Densidad de tiendas de diseño, mismo idioma y envío dentro de la UE.', canal: 'Tiendas y estudios, correo personalizado', dificultad: 'media' },
        { pais: country2, motivo: 'Demanda de diseño latinoamericano y menor competencia de lámparas impresas.', canal: 'Concept stores y distribuidores', dificultad: 'media' },
        { pais: country3, motivo: 'Ticket más alto y estudios acostumbrados a comprar a makers.', canal: 'Interioristas y marketplaces curados', dificultad: 'alta' },
      ],
      angulos: [
        { angulo: 'La sombra también es parte del diseño', prueba: 'Fotos cenitales de la sombra proyectada en pared', uso: 'contenido' },
        { angulo: 'Una serie corta, no una producción infinita', prueba: 'Número de serie y color personalizable', uso: 'venta' },
        { angulo: 'Diseñada para el departamento pequeño', prueba: 'Medidas y peso reales, instalación sin obra', uso: 'ambos' },
      ],
      riesgos: [
        'El precio percibido puede ser alto para una marca sin trayectoria; hay que mostrar proceso y detalle.',
        'La lámpara es frágil en tránsito: el packaging y el seguro son parte del producto.',
        'La producción de una sola persona limita pedidos grandes; no prometer plazos imposibles.',
      ],
      supuestos: [
        `Costo de producción estimado en ${money(cost, currency)}; confirmar con una hoja de costos real.`,
        'El comprador acepta esperar 2 a 3 semanas por una pieza hecha a pedido.',
      ],
      preguntas_abiertas: [
        '¿Cuántas unidades por semana puede producir sin descuidar la terminación?',
        '¿La instalación eléctrica es desenchufable y cumple la normativa del país destino?',
        '¿Hay fotos de la lámpara encendida en un ambiente real, no solo sobre fondo neutro?',
      ],
      criterio_de_exito: 'Conseguir 8 conversaciones reales con compradores y 2 pedidos de muestra o cotización en 30 días.',
    };
  }

  if (stepId === 'research') {
    return {
      panorama: `El mercado de iluminación de diseño vive un momento de piezas con presencia física: lámparas que funcionan como objeto incluso apagadas. La impresión 3D dejó de ser una novedad y empieza a evaluarse por terminación, no por tecnología. ${name} compite menos con lámparas industriales baratas y más con objetos de autor, cerámica y vidrio soplado. La oportunidad está en tiendas pequeñas y estudios que necesitan una pieza con relato y pueden vender una serie corta. El riesgo es quedar en la categoría "hecho a mano" sin una propuesta visual clara.`,
      tendencias: [
        { tendencia: 'Luz cálida y regulable como objeto de ambientación', evidencia: 'Las tiendas de diseño consultadas priorizan lámparas que generan atmósfera, no solo iluminación funcional.', fuente: 'https://example.com/tendencias-luz-2026' },
        { tendencia: 'Series cortas y personalización de color', evidencia: 'Los compradores de concept stores piden variantes exclusivas por ciudad para diferenciarse.', fuente: 'https://example.com/series-cortas' },
        { tendencia: 'Transparencia de materiales y reparabilidad', evidencia: 'Las fichas de producto con materiales, peso y repuestos responden mejor en tiendas de la UE.', fuente: 'https://example.com/materiales' },
      ],
      competidores: [
        { nombre: 'Estudio Línea (ejemplo)', pais: 'España', precio: `${currency} 190–260`, canal: 'Tienda propia y showrooms', fortaleza: 'Fotos de ambiente muy cuidadas y packaging premium.', hueco: 'No personaliza color y tarda 6 semanas.' },
        { nombre: 'Norte Objetos (ejemplo)', pais: 'México', precio: `${currency} 140–210`, canal: 'Concept stores', fortaleza: 'Precio accesible y red de 12 tiendas.', hueco: 'Diseño más masivo; poca historia de autor.' },
        { nombre: 'Studio Halo (ejemplo)', pais: 'Estados Unidos', precio: `${currency} 320–480`, canal: 'Interioristas', fortaleza: 'Certificación UL y logística resuelta.', hueco: 'Plazos largos y mínimos de 20 unidades.' },
      ],
      demanda: {
        senales: [
          'Aumentan las búsquedas de "lámpara de autor" y "lámpara impresa en 3D" en tiendas de nicho.',
          'Los estudios de interiorismo consultados compran piezas de 150 a 350 USD para proyectos residenciales.',
          'La temporada fuerte va de septiembre a diciembre y de marzo a mayo.',
        ],
        temporadas: 'Sep–dic (preparación de fin de año) y mar–may (reformas de primavera).',
        terminos: ['lámpara de autor', 'designer pendant light', 'lámpara impresa en 3D', 'statement lighting', 'luz cálida regulable'],
      },
      canales: [
        { canal: 'Tiendas de diseño independientes', por_que: 'Validan la pieza con su clientela y piden series cortas.', esfuerzo: 'medio' },
        { canal: 'Estudios de interiorismo', por_que: 'Compran varias unidades por proyecto y valoran la personalización.', esfuerzo: 'medio' },
        { canal: 'Venta directa online', por_que: 'Margen alto, pero exige tráfico y confianza.', esfuerzo: 'alto' },
      ],
      fuentes: [
        { titulo: 'Tendencias de iluminación de diseño 2026 (ejemplo)', url: 'https://example.com/tendencias-luz-2026' },
        { titulo: 'Cómo compran las tiendas de diseño (ejemplo)', url: 'https://example.com/compradores-diseno' },
        { titulo: 'Guía de packaging para piezas frágiles (ejemplo)', url: 'https://example.com/packaging-fragil' },
      ],
      conclusion: `La oportunidad no es competir por precio: es entrar por tiendas pequeñas y estudios con una pieza que se explica en 30 segundos. ${country1} es el mercado de prueba natural; ${country2} el de escala regional; ${country3} el de ticket alto con más fricción.`,
    };
  }

  if (stepId === 'customs') {
    return {
      resumen: `Antes del primer envío hay que resolver tres cosas: código HS y valor declarado, certificación eléctrica del destino y packaging apto para frágil. Para probar mercado, conviene empezar con envíos individuales y no con un pallet.`,
      paises: [
        {
          pais: country1,
          codigo_hs: '9405.21 (lámparas eléctricas de mesa, salón o dormitorio) — verificar',
          arancel_estimado: '0% dentro de la UE; 2,7%–4,7% si ingresa desde fuera',
          impuestos: 'IVA 21% (España) sobre valor + flete + seguro',
          requisitos: ['Marcado CE', 'Declaración UE de conformidad', 'Instrucciones y datos del fabricante en el idioma local'],
          etiquetado: 'Etiqueta con fabricante/importador, modelo, tensión y potencia.',
          certificaciones: ['CE', 'RoHS', 'EN 60598 para luminarias'],
          incoterm: 'DAP (evita que el comprador se sorprenda con gastos)',
          courier: 'DHL Express o UPS; comparar ambos para 3–8 kg',
          riesgo: 'medio',
          notas: 'Si ya hay stock en la UE, el envío interno no paga arancel. La certificación es responsabilidad del fabricante/importador.',
          fuente: 'https://example.com/aduanas-ue-luminarias',
        },
        {
          pais: country2,
          codigo_hs: '9405.21 — verificar con despachante',
          arancel_estimado: '5%–15% según fracción y origen',
          impuestos: 'IVA 16% + posible DTA',
          requisitos: ['Factura comercial', 'Certificado de origen si aplica', 'NOM-003-SCFI para producto eléctrico'],
          etiquetado: 'País de origen, importador, tensión y potencia.',
          certificaciones: ['NOM (si se comercializa formalmente)', 'RoHS'],
          incoterm: 'DAP o DDP para tiendas pequeñas',
          courier: 'DHL Express; revisar despacho aduanal para valores altos',
          riesgo: 'alto',
          notas: 'La clasificación puede cambiar si la lámpara se considera decorativa o luminaria eléctrica. Confirmar antes de cotizar.',
          fuente: 'https://example.com/aduanas-mexico-luminarias',
        },
        {
          pais: country3,
          codigo_hs: '9405.21.20 — verificar',
          arancel_estimado: '3,9%–7,5% + posibles aranceles adicionales vigentes',
          impuestos: 'Sales tax estatal según destino; no hay IVA federal',
          requisitos: ['FCC si incluye componentes electrónicos', 'UL/ETL para venta en tiendas', 'Etiquetado en inglés'],
          etiquetado: 'Fabricante, modelo, tensión, potencia y advertencias.',
          certificaciones: ['UL/ETL', 'FCC', 'RoHS (estado de California)'],
          incoterm: 'DAP',
          courier: 'UPS o FedEx; el comprador suele tener cuenta',
          riesgo: 'alto',
          notas: 'Los aranceles cambiaron varias veces; cotizar el día del envío y no prometer precio final sin revisar.',
          fuente: 'https://example.com/aduanas-eeuu-luminarias',
        },
      ],
      documentos: [
        'Factura comercial con descripción técnica y código HS',
        'Packing list con peso y dimensiones por bulto',
        'Declaración de origen',
        'Certificado de conformidad eléctrica del destino',
        'Seguro de transporte por valor declarado',
      ],
      advertencia: 'Esta guía es orientativa y de ejemplo. Los aranceles, impuestos y certificaciones cambian por país, fecha y valor declarado. Antes del primer envío, confirmá con un despachante o con el courier.',
    };
  }

  if (stepId === 'pricing') {
    const direct = price;
    const wholesale = Math.round(price * 0.65);
    const gallery = Math.round(price * 0.8);
    const directProfit = Math.round(direct * 0.92 - cost - 18);
    const wholesaleProfit = Math.round(wholesale - cost - 12);
    const galleryProfit = Math.round(gallery * 0.8 - cost - 10);
    return {
      moneda: currency,
      supuestos: [
        `Costo de producción de ${money(cost, currency)} (materiales, impresión, terminación y embalaje).`,
        'Flete local promedio de 18 USD para venta directa; el mayorista paga el suyo.',
        'Comisión de plataforma de 8% en venta directa y 20% en galería.',
        'No incluye publicidad paga ni tiempo del dueño.',
      ],
      costos: {
        materiales: Math.round(cost * 0.45),
        mano_obra: Math.round(cost * 0.35),
        packaging: Math.round(cost * 0.12),
        envio_local: 18,
        otros: Math.round(cost * 0.08),
      },
      escenarios: [
        { canal: 'Directo online', precio: direct, comision_pct: 8, envio: 18, ganancia: directProfit, margen_pct: Math.round((directProfit / direct) * 100), notas: 'Precio de referencia. Incluye envío y packaging reforzado.' },
        { canal: 'Mayorista', precio: wholesale, comision_pct: 0, envio: 0, ganancia: wholesaleProfit, margen_pct: Math.round((wholesaleProfit / wholesale) * 100), notas: '35% de descuento sobre directo. Mínimo 4 unidades para amortizar el envío.' },
        { canal: 'Galería / interiorista', precio: gallery, comision_pct: 20, envio: 0, ganancia: galleryProfit, margen_pct: Math.round((galleryProfit / gallery) * 100), notas: '20% de comisión. Funciona si la galería aporta cliente y montaje.' },
      ],
      psicologia: `${Math.round(direct)} funciona mejor que ${Math.round(direct) + 6}: el precio queda abajo del umbral redondo y transmite serie corta, no producción masiva.`,
      descuentos: [
        { tipo: 'Primera compra mayorista', condicion: 'Mínimo 4 unidades', limite: '10% adicional, solo primera orden' },
        { tipo: 'Pack de 2 para estudio', condicion: 'Mismo color y mismo envío', limite: '8%' },
        { tipo: 'Personalización de color', condicion: 'Pedido mínimo 3 unidades', limite: 'Sin descuento; se cobra 12% extra' },
      ],
      landed_cost: [
        { pais: country1, costo: Math.round(cost + 34), supuestos: 'Flete aéreo 3 kg + seguro + arancel estimado + IVA recuperable para empresa.' },
        { pais: country2, costo: Math.round(cost + 46), supuestos: 'Flete + despacho + IVA; incluye packaging reforzado.' },
        { pais: country3, costo: Math.round(cost + 39), supuestos: 'Flete + arancel estimado; no incluye sales tax estatal.' },
      ],
      recomendacion: `Salir a ${money(direct, currency)} directo, ${money(wholesale, currency)} mayorista y ${money(gallery, currency)} galería. No bajar de ${money(wholesale, currency)} en mayorista: debajo de eso la pieza no paga el tiempo de producción ni el packaging.`,
      advertencia: 'Los números son un modelo de trabajo, no una liquidación. Reemplazá costo, flete y comisiones por tus valores reales antes de cotizar.',
    };
  }

  if (stepId === 'prospecting') {
    return {
      segmentos: [
        { segmento: 'Concept stores de diseño', por_que: 'Venden objetos con relato y aceptan series cortas.', donde_buscar: ['Directorios de diseño local', 'Instagram de tiendas de diseño', 'Ferias de diseño independiente'], volumen: 'medio' },
        { segmento: 'Estudios de interiorismo', por_que: 'Compran varias unidades por proyecto y valoran personalización.', donde_buscar: ['Colegios de arquitectos', 'Proyectos publicados en revistas de diseño', 'LinkedIn'], volumen: 'alto' },
        { segmento: 'Hoteles boutique', por_que: 'Necesitan repetibilidad y una pieza que resista uso intensivo.', donde_buscar: ['Hoteles independientes de 10–40 habitaciones', 'Estudios de arquitectura hotelera'], volumen: 'bajo' },
      ],
      compradores: buyerList(product, markets, currency, price),
      canales: [
        { canal: 'Correo personalizado', como: '3 líneas específicas sobre la tienda + una foto + un pedido claro.', esfuerzo: 'medio', retorno: 'alto' },
        { canal: 'Instagram DM', como: 'Solo después de interactuar con una publicación; mensaje de 35 palabras.', esfuerzo: 'bajo', retorno: 'medio' },
        { canal: 'Muestra física', como: 'Enviar una unidad pequeña a 3 tiendas clave y pedir feedback honesto.', esfuerzo: 'alto', retorno: 'alto' },
      ],
      proximos_pasos: [
        'Verificar los 5 contactos de mayor prioridad y descartar los que no tengan email publicado.',
        'Preparar una ficha de una página con medidas, materiales, fotos y precio mayorista.',
        'Enviar 5 correos por día como máximo durante la primera semana.',
      ],
      faltantes: [
        'Faltan nombres de compradores específicos en 4 tiendas; hay que buscar en LinkedIn o llamar.',
        'No se verificó si las tiendas aceptan marcas sin certificación local.',
      ],
      demo: true,
    };
  }

  if (stepId === 'enrichment') {
    const buyers = ctx.artifacts?.prospecting?.compradores || [];
    const conEmail = buyers.filter((b) => b.email).length;
    return {
      revisados: buyers.length,
      encontrados: conEmail,
      verificados: Math.min(conEmail, 3),
      sin_contacto: buyers.length - conEmail,
      metodo: 'Sitios web públicos y patrón de correo. Datos de ejemplo; en una misión real se consulta Hunter si está configurado.',
      detalle: buyers.map((b) => ({
        comprador: b.nombre,
        email: b.email || '',
        estado: b.email ? 'publico' : 'sin contacto',
        nota: b.email ? 'Email publicado en el sitio (ejemplo).' : 'Buscar contacto en LinkedIn o formulario web.',
      })),
      demo: true,
    };
  }

  if (stepId === 'outreach') {
    const buyers = ctx.artifacts?.prospecting?.compradores || buyerList(product, markets, currency, price);
    // Un mensaje por comprador: el flujo no reutiliza el correo de otra tienda.
    const top = buyers;
    const messages = top.map((buyer, index) => {
      const english = ['Estados Unidos', 'Reino Unido', 'Dinamarca'].includes(buyer.pais);
      const french = buyer.pais === 'Francia';
      if (english) {
        return {
          comprador: buyer.nombre,
          pais: buyer.pais,
          idioma: 'en',
          asunto: `${name}: a small series for ${buyer.nombre}`,
          cuerpo: `Hi ${buyer.nombre} team,\n\nI saw your selection of ${index % 2 === 0 ? 'sculptural lighting and small-series objects' : 'design pieces for compact interiors'} and thought ${name} might fit.\n\nIt is a 3D-printed pendant lamp with a warm, dimmable light and a geometric shade that casts a distinct shadow. Each piece is made to order in a small series and can be finished in a custom color.\n\nRetail is ${money(price, currency)}; wholesale starts at 4 units. I can send a one-page spec sheet with dimensions, materials and lead time.\n\nWould it make sense to send it over?\n\n— ${ctx.brand?.maker || ctx.brand?.name || 'Lumbre'}\n${ctx.brand?.website || ''}`,
          personalizacion: `Menciona ${index % 2 === 0 ? 'su selección de piezas escultóricas' : 'su trabajo en interiores compactos'} y ofrece ficha técnica.`,
          cta: 'Pedir permiso para enviar la ficha de una página.',
        };
      }
      if (french) {
        return {
          comprador: buyer.nombre,
          pais: buyer.pais,
          idioma: 'fr',
          asunto: `${name} — une petite série pour ${buyer.nombre}`,
          cuerpo: `Bonjour,\n\nJ'ai vu votre sélection d'objets de créateurs et je pense que ${name} pourrait trouver sa place chez vous.\n\nC'est une suspension imprimée en 3D, avec une lumière chaude et un abat-jour géométrique qui projette une ombre très particulière. Chaque pièce est fabriquée à la commande, en petite série, et peut être teintée dans une couleur sur mesure.\n\nLe prix de détail est de ${money(price, currency)} ; le tarif professionnel commence à partir de 4 pièces. Je peux vous envoyer une fiche technique d'une page avec les dimensions, les matériaux et le délai.\n\nSouhaitez-vous que je vous l'envoie ?\n\n— ${ctx.brand?.maker || ctx.brand?.name || 'Lumbre'}`,
          personalizacion: 'Reconoce la curaduría de la galería y ofrece ficha técnica en francés.',
          cta: 'Ofrecer la ficha técnica sin adjuntar archivos en el primer mensaje.',
        };
      }
      return {
        comprador: buyer.nombre,
        pais: buyer.pais,
        idioma: 'es',
        asunto: `${name}: una serie corta para ${buyer.nombre}`,
        cuerpo: `Hola,\n\nVi la selección de ${buyer.nombre} y me pareció que ${name} puede encajar con lo que muestran: piezas con presencia, no solo lámparas para iluminar.\n\nEs una luminaria impresa en 3D, con luz cálida regulable y una pantalla geométrica que proyecta una sombra propia. La hacemos a pedido, en series cortas, y se puede elegir el color del cable y de la pantalla.\n\nEl precio de venta sugerido es ${money(price, currency)}; el mayorista arranca en 4 unidades. Te puedo mandar una ficha de una página con medidas, materiales y plazo de producción.\n\n¿Te sirve que te la envíe?\n\n— ${ctx.brand?.maker || ctx.brand?.name || 'Lumbre'}\n${ctx.brand?.website || ''}`,
        personalizacion: `Menciona la selección de la tienda y ofrece una ficha concreta, sin adjuntos en el primer correo.`,
        cta: 'Pedir permiso para enviar la ficha.',
      };
    });

    return {
      estrategia: 'Entrar por tiendas y estudios pequeños con una pieza explicable en 30 segundos. Primero España y México; EE. UU. solo con contactos que ya compran a makers. Un solo pedido por mensaje: permiso para enviar la ficha.',
      secuencia: [
        { paso: 1, dia: 0, objetivo: 'Abrir la conversación con una observación específica, no con un pitch.', asunto: `${name}: una serie corta`, cuerpo: `Hola,\n\nVi que en ${'{tienda}'} trabajan con piezas de autor. ${name} es una lámpara impresa en 3D, de serie corta, con luz cálida y una sombra que se nota en la pared.\n\n¿Te interesa que te mande la ficha con medidas y precio mayorista?\n\n— ${ctx.brand?.maker || 'Lumbre'}` },
        { paso: 2, dia: 4, objetivo: 'Aportar valor sin repetir el primer mensaje.', asunto: 'Una foto de la sombra (y medidas)', cuerpo: `Hola de nuevo,\n\nTe dejo una referencia concreta: la pantalla mide 32 cm de diámetro y proyecta una sombra de 60 cm sobre la pared. Es lo que más llama la atención en las fotos.\n\nSi querés, te envío la ficha completa y una foto del detalle de la terminación.\n\n— ${ctx.brand?.maker || 'Lumbre'}` },
        { paso: 3, dia: 10, objetivo: 'Cerrar con dignidad y dejar la puerta abierta.', asunto: 'Cierro el tema por ahora', cuerpo: `Hola,\n\nNo quiero sumarte otro correo a la bandeja. Si en este momento no es el momento, lo dejo acá.\n\nSi más adelante armás una vidriera o un proyecto donde entre una lámpara de serie corta, escribime y te mando la ficha actualizada.\n\nGracias por tu tiempo.\n\n— ${ctx.brand?.maker || 'Lumbre'}` },
      ],
      mensajes: messages,
      whatsapp: top.slice(0, 3).map((buyer) => ({
        comprador: buyer.nombre,
        mensaje: `Hola, soy ${ctx.brand?.maker || 'el maker'} de ${ctx.brand?.name || 'Lumbre'}. Vi la selección de ${buyer.nombre} y creo que ${name} puede encajar. ¿Te puedo mandar una ficha con medidas y precio mayorista?`,
      })),
      objeciones: [
        { objecion: 'El precio es alto para una marca que no conocemos.', respuesta: `Entiendo. El precio incluye producción a pedido, packaging reforzado y una pieza que no se repite en otras tiendas. Si querés probar sin riesgo, empecemos con una unidad y vemos cómo reacciona tu cliente.` },
        { objecion: '¿Es eléctricamente segura para nuestro país?', respuesta: 'La lámpara se entrega con cableado y ficha técnica; antes del primer envío confirmo la certificación que corresponde al destino. No prometo una certificación que no tenga.' },
        { objecion: 'No trabajamos con marcas nuevas.', respuesta: 'Tiene sentido. Si te sirve, te dejo la ficha para que la veas cuando tengas una vidriera o un cliente que busque algo distinto. Sin seguimiento.' },
      ],
      firma: `${ctx.brand?.maker || ctx.brand?.name || 'Lumbre'}\n${ctx.brand?.tagline || 'Lámparas de diseño impresas en 3D'}\n${ctx.brand?.website || ''}`,
      reglas: [
        'Máximo 5 correos nuevos por día durante la primera semana.',
        'No adjuntar archivos en el primer mensaje: pedir permiso primero.',
        'Un seguimiento a los 4 días y un cierre a los 10. Después, no insistir.',
        'Si responden "no", cerrar con dignidad y no volver a escribir.',
        'No usar urgencia falsa ni descuentos que no estén aprobados.',
      ],
      demo: true,
    };
  }

  if (stepId === 'content') {
    return {
      pilares: [
        { pilar: 'La sombra como diseño', idea: 'Mostrar cómo cambia la pared cuando la lámpara se enciende.' },
        { pilar: 'Hecho en serie corta', idea: 'Explicar por qué hay pocas unidades y cómo se elige el color.' },
        { pilar: 'La lámpara en un departamento real', idea: 'Probarla en espacios pequeños, no en un showroom infinito.' },
      ],
      calendario: [
        { dia: 'Día 1', plataforma: 'Instagram', formato: 'Reel 8 s', gancho: 'Apagada también es una escultura.', guion: 'Plano fijo de la lámpara apagada. Se enciende. La sombra aparece en la pared. Corte al detalle de la terminación.', caption: `Una lámpara no solo ilumina: también dibuja. ${name}, impresa en 3D en series cortas.`, hashtags: ['#iluminaciondediseno', '#lamparadeautor', '#impresion3d', '#disenoindustrial', '#luzcalida'], cta: 'Guardá el reel para tu próxima reforma.' },
        { dia: 'Día 2', plataforma: 'TikTok', formato: 'Video 15 s', gancho: 'Así se imprime una lámpara que no se ve en cualquier lado.', guion: 'Timelapse de impresión → manos lijando → lámpara terminada → sombra en la pared.', caption: `De un rollo de filamento a una pieza que proyecta su propia sombra. ${name}, hecha a pedido.`, hashtags: ['#3dprinting', '#lightingdesign', '#makers', '#diseño'], cta: 'Comentá "luz" y te cuento cómo se elige el color.' },
        { dia: 'Día 3', plataforma: 'Pinterest', formato: 'Foto vertical', gancho: 'La lámpara que hace que un rincón chico se vea intencional.', guion: 'Foto de ambiente con la lámpara encendida, texto mínimo sobre la imagen.', caption: `Un rincón, una luz cálida y una sombra que cambia según la hora.`, hashtags: ['#smallspaces', '#lightinginspo', '#designlamp', '#warmlight'], cta: 'Guardá la idea para tu rincón de lectura.' },
        { dia: 'Día 4', plataforma: 'Instagram', formato: 'Carrusel 4 placas', gancho: 'Tres colores. Una misma sombra.', guion: 'Placa 1: las tres lámparas juntas. Placa 2: detalle de cada terminación. Placa 3: la sombra de cada una. Placa 4: cómo elegir.', caption: `El color cambia la pieza; la sombra sigue siendo la misma. ¿Con cuál te quedás?`, hashtags: ['#colordesign', '#lamparas', '#interiores', '#hechoapedido'], cta: 'Elegí tu color en los comentarios.' },
        { dia: 'Día 5', plataforma: 'TikTok', formato: 'Video 20 s', gancho: 'Lo que nadie te muestra del packaging de una lámpara frágil.', guion: 'Mostrar el packaging, la espuma, el seguro y el test de caída. Cerrar con la lámpara llegando entera.', caption: `Una lámpara frágil no se manda en una caja cualquiera. Así viaja ${name}.`, hashtags: ['#packagingdesign', '#smallbusiness', '#makers', '#logistica'], cta: 'Si tenés una tienda, pedí la ficha técnica.' },
        { dia: 'Día 6', plataforma: 'Instagram', formato: 'Historia con encuesta', gancho: '¿La pondrías en el comedor o en la entrada?', guion: 'Foto de la lámpara en dos ambientes. Encuesta: comedor / entrada. Respuesta con un dato de instalación.', caption: '', hashtags: [], cta: 'Respondé la encuesta.' },
        { dia: 'Día 7', plataforma: 'Pinterest', formato: 'Pin de ficha técnica', gancho: 'Medidas, materiales y luz: todo en una imagen.', guion: 'Infografía simple con silueta, medidas, materiales y temperatura de color.', caption: `Ficha clara para decidir sin adivinar. ${name}, serie corta.`, hashtags: ['#specsheet', '#lightingdesign', '#interiorarchitecture'], cta: 'Guardá el pin para tu próximo proyecto.' },
      ],
      ganchos: [
        'Apagada también es una escultura.',
        'La sombra no es un efecto: es parte del diseño.',
        'Una lámpara chica no tiene que verse chica.',
        'No es impresión 3D. Es una pieza hecha a pedido.',
        'El color lo elegís vos; la geometría la elegimos nosotros.',
      ],
      serie: {
        nombre: 'Una lámpara, siete luces',
        descripcion: 'Siete videos cortos, uno por día, mostrando la misma lámpara en siete rincones distintos de una casa real. Sirve para demostrar versatilidad sin producir siete productos.',
        episodios: ['Rincón de lectura', 'Comedor chico', 'Entrada', 'Escritorio', 'Dormitorio', 'Cocina', 'Balcón'],
      },
      fotos: [
        { toma: 'Lámpara encendida a 40 cm de la pared, cámara a la altura de la sombra.', por_que: 'La sombra es el diferencial y casi nadie la muestra.' },
        { toma: 'Detalle macro de la terminación y la unión de la pantalla.', por_que: 'Responde la objeción "parece plástico".' },
        { toma: 'Ambiente real con referencia de escala (una silla o una mesa).', por_que: 'Evita que la lámpara parezca más grande de lo que es.' },
        { toma: 'Packaging abierto, con la lámpara y las protecciones.', por_que: 'Da confianza para comprar online.' },
      ],
      advertencia: 'Contenido de ejemplo. No usar afirmaciones de sustentabilidad o certificación que no estén documentadas.',
      demo: true,
    };
  }

  if (stepId === 'compliance') {
    return {
      veredicto: 'con_cambios',
      riesgos: [
        { nivel: 'alto', tema: 'Certificación eléctrica', detalle: 'Se sugiere que la lámpara está lista para cualquier país, pero no hay certificación UL/CE documentada en la ficha.', arreglo: 'No afirmar certificación hasta tenerla. En la ficha, indicar "consultar disponibilidad de versión certificada por país".' },
        { nivel: 'medio', tema: 'Claim de sostenibilidad', detalle: 'El contenido sugiere "materiales sustentables" sin evidencia del proveedor de filamento.', arreglo: 'Reemplazar por "filamento PLA de proveedor local" solo si es verificable; si no, quitar el claim.' },
        { nivel: 'medio', tema: 'Contacto en frío', detalle: 'Los correos no incluyen identificación completa del remitente ni dirección física ni opt-out explícito.', arreglo: 'Agregar firma con nombre, ciudad, web y una línea: "Si preferís no recibir más mensajes, respondé BAJA".' },
        { nivel: 'bajo', tema: 'Precios y aranceles', detalle: 'Los valores de aduana son estimaciones y pueden cambiar.', arreglo: 'Mantener la advertencia y no prometer precio final de importación.' },
      ],
      claims_a_evitar: [
        '"Certificada para todo el mundo"',
        '"Materiales 100% sustentables"',
        '"La lámpara más liviana del mercado"',
        '"Envío garantizado en 48 horas"',
        '"Única en el mundo" (si se produce en serie)',
      ],
      email: {
        base_legal: 'Contacto B2B a una dirección publicada en el sitio de la tienda, con interés legítimo. En la UE, incluir identidad y opt-out; en EE. UU., cumplir CAN-SPAM con dirección física y baja.',
        opt_out: 'Agregar una línea visible al pie: "Si no te interesa recibir más mensajes, respondé BAJA y no vuelvo a escribir".',
        datos_personales: 'No usar listas compradas. Guardar solo nombre, empresa, email profesional y contexto de la conversación. Borrar a quien lo pida.',
      },
      aduanas: [
        'Confirmar código HS y certificación antes de cotizar un envío internacional.',
        'No prometer entrega puerta a puerta sin verificar el courier y el despacho.',
      ],
      correcciones: [
        { campo: 'mensaje', original: 'luz cálida regulable', sugerido: 'luz cálida regulable (versión estándar 220–240 V; consultar versión 110 V y certificación local antes de comprar)' },
        { campo: 'mensaje', original: 'warm, dimmable light', sugerido: 'warm, dimmable light (standard 220–240 V; check 110 V and local certification before ordering)' },
        { campo: 'mensaje', original: 'lumière chaude', sugerido: 'lumière chaude (version standard 220–240 V ; vérifier la version 110 V et la certification locale avant commande)' },
      ],
      checklist: [
        { item: 'Firma con identidad y ciudad', ok: false },
        { item: 'Opt-out claro en cada correo', ok: false },
        { item: 'Sin certificaciones inventadas', ok: false },
        { item: 'Precios con supuestos explícitos', ok: true },
        { item: 'Advertencia de aduana incluida', ok: true },
      ],
      demo: true,
    };
  }

  if (stepId === 'redteam') {
    return {
      veredicto: 'ajustar',
      supuestos_fragiles: [
        { supuesto: 'Las tiendas van a comprar una lámpara de 240 USD de un maker sin trayectoria.', por_que_falla: 'El comprador asume riesgo de devolución y de rotación. Sin prueba social, el precio se vuelve la objeción principal.', prueba_barata: 'Ofrecer una unidad en consignación a 2 tiendas y medir si se vende en 30 días.' },
        { supuesto: 'El margen mayorista de 53% alcanza.', por_que_falla: 'No incluye devoluciones, reposición por rotura ni el tiempo de atención. Un 10% de rotura se come el margen.', prueba_barata: 'Calcular el margen con 10% de pérdida y 2 horas de atención por pedido.' },
        { supuesto: 'El contenido va a generar demanda en 7 días.', por_que_falla: 'Siete piezas es un inicio, no una estrategia. Sin audiencia previa, el alcance orgánico será bajo.', prueba_barata: 'Publicar 3 piezas y medir guardados y consultas, no likes.' },
      ],
      agujeros: [
        { area: 'precio', problema: 'El landed cost a México (46 USD) más IVA y despacho puede dejar el mayorista en pérdida si se ofrece envío incluido.', impacto: 'alto', arreglo: 'Cotizar DAP y no incluir envío en el precio mayorista. Pedir al comprador su cuenta de courier.' },
        { area: 'aduanas', problema: 'La certificación NOM/UL se menciona como requisito, pero el plan no dice cómo obtenerla ni cuánto cuesta.', impacto: 'alto', arreglo: 'Antes de vender a tiendas de México/EE. UU., confirmar con un laboratorio el costo y plazo de certificación; mientras tanto, vender solo a compradores que acepten importar bajo su responsabilidad.' },
        { area: 'mensaje', problema: 'Los mensajes hablan de "serie corta" y "sombra", pero no dicen quién está detrás ni por qué deberían confiar.', impacto: 'medio', arreglo: 'Agregar una línea con nombre, ciudad y link a Instagram; incluir una foto del proceso.' },
        { area: 'operacion', problema: 'El plan de 7 días asume 3 horas diarias además de producir.', impacto: 'medio', arreglo: 'Reducir a 5 contactos por día y bloquear 90 minutos reales, no 3 horas.' },
        { area: 'mercado', problema: 'Se priorizan 3 países a la vez para una persona sola.', impacto: 'alto', arreglo: 'Elegir un solo país para la primera semana y sumar el segundo recién con 5 conversaciones.' },
      ],
      preguntas_dificiles: [
        '¿Cuántas lámparas podés producir por semana sin que la terminación baje?',
        '¿Qué pasa si una tienda pide 30 unidades para una fecha?',
        '¿Tenés fotos de la lámpara en un ambiente real, con escala?',
        '¿Cuánto cuesta realmente la certificación eléctrica en el país que elegiste?',
        '¿Venderías una unidad en consignación para probar?',
      ],
      escenarios: [
        { escenario: 'La tienda pide 20 unidades y no hay capacidad.', probabilidad: 'media', plan_b: 'Ofrecer serie de 8 con entrega escalonada y precio mayorista; no aceptar lo que no se puede cumplir.' },
        { escenario: 'El envío llega roto.', probabilidad: 'media', plan_b: 'Seguro + packaging probado + repuesto de pantalla impreso en 48 h.' },
        { escenario: 'Nadie responde a los correos.', probabilidad: 'alta', plan_b: 'Cambiar de canal: visita física a 5 tiendas con una muestra y una ficha impresa.' },
      ],
      lo_que_sobra: [
        'Abrir tres países a la vez.',
        'Un calendario de siete piezas antes de tener una sola conversación.',
        'El claim de sostenibilidad sin documentación.',
      ],
      sello: 'El riesgo no es el precio: es pedirle a una tienda que apueste por una marca sin prueba, sin certificación y sin capacidad de reponer rápido.',
      demo: true,
    };
  }

  if (stepId === 'revision') {
    return {
      cambios: [
        { que: 'Enviar solo a España en la primera semana', por_que: 'El red team mostró que tres países a la vez es inviable para una persona sola.' },
        { que: 'Quitar el envío incluido del precio mayorista', por_que: 'El landed cost a México puede eliminar el margen.' },
        { que: 'Agregar identidad y opt-out en todos los correos', por_que: 'Cumplimiento detectó un riesgo alto.' },
      ],
      mensajes: [
        { comprador: 'Luz de Autor', asunto: `${name}: una serie corta para Luz de Autor`, cuerpo: `Hola,\n\nVi la selección de Luz de Autor y me pareció que ${name} puede encajar: una lámpara impresa en 3D, de serie corta, con luz cálida y una pantalla que proyecta una sombra propia.\n\nSoy ${ctx.brand?.maker || 'el maker'} de ${ctx.brand?.name || 'Lumbre'}, en ${ctx.brand?.city || 'Buenos Aires'}. Te puedo mandar una ficha de una página con medidas, materiales y precio mayorista (desde 4 unidades, sin envío incluido).\n\n¿Te sirve que te la envíe?\n\n— ${ctx.brand?.maker || 'Lumbre'}\n${ctx.brand?.website || ''}\nSi preferís no recibir más mensajes, respondé BAJA.` },
      ],
      ajustes_plan: [
        'Semana 1: solo España, 5 contactos por día, 90 minutos diarios.',
        'No prometer certificación ni plazos hasta confirmarlos.',
        'Ofrecer una unidad en consignación a 2 tiendas como prueba.',
      ],
      riesgos_que_quedan: [
        'La capacidad de producción sigue siendo el límite real.',
        'La certificación eléctrica para EE. UU. y México queda pendiente.',
      ],
      demo: true,
    };
  }

  if (stepId === 'synthesis') {
    return {
      decision: `Probar ${name} en España con 5 tiendas y 2 estudios, sin abrir otros mercados hasta tener 5 conversaciones reales.`,
      tesis: `Una lámpara de autor impresa en 3D, explicada por su sombra y su serie corta, puede entrar en tiendas de diseño antes que en marketplaces. El precio no es el argumento; la prueba y la historia sí.`,
      plan_7_dias: [
        { dia: 1, accion: 'Elegir 5 compradores de España y verificar nombre, email y una referencia real de su tienda.', resultado: 'Lista de 5 contactos con contexto, sin fantasmas.', tiempo: '90 min' },
        { dia: 2, accion: 'Armar la ficha de una página: 4 fotos, medidas, materiales, precio mayorista y plazo real.', resultado: 'PDF o link listo para enviar cuando lo pidan.', tiempo: '2 h' },
        { dia: 3, accion: 'Enviar los 5 primeros correos personalizados, uno por uno.', resultado: '5 conversaciones abiertas; 0 adjuntos no pedidos.', tiempo: '60 min' },
        { dia: 4, accion: 'Publicar el reel "apagada también es una escultura" y responder comentarios.', resultado: 'Primera señal de interés orgánico.', tiempo: '45 min' },
        { dia: 5, accion: 'Visitar 2 tiendas en persona con una muestra pequeña y la ficha impresa.', resultado: 'Feedback directo sobre precio y terminación.', tiempo: '3 h' },
        { dia: 6, accion: 'Hacer seguimiento solo a quien abrió o respondió; no insistir a quien no.', resultado: '2 conversaciones activas como mínimo.', tiempo: '30 min' },
        { dia: 7, accion: 'Revisar números: respuestas, muestras pedidas, objeciones. Ajustar precio o mensaje.', resultado: 'Decisión para la semana 2, no una sensación.', tiempo: '45 min' },
      ],
      prioridades: [
        { prioridad: 1, accion: 'Conseguir 5 conversaciones reales con tiendas de España', por_que: 'Es la señal más barata de si el producto y el precio tienen lugar.', metrica: '5 correos enviados, 2 respuestas' },
        { prioridad: 2, accion: 'Probar una unidad en consignación', por_que: 'Reduce el riesgo percibido sin regalar margen.', metrica: '1 acuerdo de consignación firmado por email' },
        { prioridad: 3, accion: 'Documentar la certificación eléctrica', por_que: 'Sin eso, México y EE. UU. quedan bloqueados.', metrica: 'Presupuesto y plazo de laboratorio' },
      ],
      mensajes_listos: [
        { comprador: 'Luz de Autor', asunto: `${name}: una serie corta para Luz de Autor`, cuerpo: `Hola,\n\nVi la selección de Luz de Autor y me pareció que ${name} puede encajar: una lámpara impresa en 3D, de serie corta, con luz cálida y una pantalla que proyecta una sombra propia.\n\nSoy ${ctx.brand?.maker || 'el maker'} de ${ctx.brand?.name || 'Lumbre'}, en ${ctx.brand?.city || 'Buenos Aires'}. Te puedo mandar una ficha de una página con medidas, materiales y precio mayorista (desde 4 unidades, sin envío incluido).\n\n¿Te sirve que te la envíe?\n\n— ${ctx.brand?.maker || 'Lumbre'}\n${ctx.brand?.website || ''}\nSi preferís no recibir más mensajes, respondé BAJA.` },
        { comprador: 'Forma Living', asunto: `${name}: una pieza para la vidriera`, cuerpo: `Hola,\n\nVi que en Forma Living mezclan mobiliario y luz de diseñadores emergentes. ${name} es una lámpara de serie corta que funciona bien en vidriera porque su sombra se ve desde la calle.\n\nTe puedo acercar una unidad para que la veas sin compromiso y, si te convence, hablamos de una serie de 4.\n\n¿Te parece si paso la semana que viene?\n\n— ${ctx.brand?.maker || 'Lumbre'}\nSi preferís no recibir más mensajes, respondé BAJA.` },
      ],
      presupuesto: {
        inversion: 80,
        detalle: 'Muestra y envío a 2 tiendas (40), packaging reforzado (20), ficha impresa (20).',
        retorno_esperado: 'No prometer retorno. El objetivo de la semana es información y 2 conversaciones, no facturación.',
      },
      metricas: [
        { metrica: 'Tasa de respuesta', meta: '2 de 5 correos', cuando: 'Día 7' },
        { metrica: 'Conversaciones activas', meta: '2', cuando: 'Día 10' },
        { metrica: 'Pedidos de muestra o cotización', meta: '1', cuando: 'Día 14' },
        { metrica: 'Costo por conversación', meta: 'Menos de 40 USD', cuando: 'Día 14' },
      ],
      no_hacer: [
        'No abrir México ni EE. UU. esta semana.',
        'No comprar listas de correos ni enviar plantillas masivas.',
        'No prometer certificaciones ni plazos que no estén confirmados.',
        'No bajar el precio mayorista para cerrar la primera venta.',
      ],
      resumen: `Probá ${name} en España, con 5 tiendas y 2 estudios, antes de abrir otros mercados. La pieza se explica por su sombra y su serie corta; el precio mayorista arranca en 4 unidades y no incluye envío. Esta semana: armá una ficha de una página, enviá 5 correos personalizados, visitá 2 tiendas con una muestra y medí respuestas. No prometas certificaciones ni plazos. Si no hay 2 conversaciones en 10 días, cambiá el ángulo o el canal antes de gastar en publicidad.`,
      demo: true,
    };
  }

  if (stepId === 'learning') {
    return {
      aprendizajes: [
        { insight: 'El argumento más fuerte no es la tecnología de impresión, sino la sombra que proyecta la pieza.', evidencia: 'El red team y el análisis de contenido coinciden en que la sombra es el diferencial visual.', confianza: 'media', aplicar: 'Usar la sombra como gancho principal en la próxima campaña y en la primera foto.', etiqueta: 'mensaje' },
        { insight: 'El precio mayorista necesita un mínimo de 4 unidades para absorber packaging y atención.', evidencia: 'El escenario de precios muestra que con 1 unidad el margen se reduce a la mitad.', confianza: 'alta', aplicar: 'Fijar mínimo de 4 unidades y no incluir envío en la cotización mayorista.', etiqueta: 'precio' },
        { insight: 'La certificación eléctrica es el verdadero cuello de botella para México y EE. UU.', evidencia: 'Cumplimiento y aduanas la marcan como requisito alto y el plan no tiene costo ni plazo.', confianza: 'alta', aplicar: 'Pedir presupuesto a un laboratorio antes de prospectar esos mercados.', etiqueta: 'aduanas' },
        { insight: 'Un solo país en la primera semana produce más aprendizaje que tres mercados a la vez.', evidencia: 'El red team detectó que el plan original no cabía en el tiempo de una persona sola.', confianza: 'alta', aplicar: 'Elegir un mercado de prueba por misión y ampliar solo con conversaciones.', etiqueta: 'operacion' },
      ],
      demo: true,
    };
  }

  return { nota: 'Paso de ejemplo sin contenido específico.', demo: true };
}

/* ─────────────────────────────────────────────────────────────
   Imágenes de ejemplo (SVG) para que la app no arranque vacía
   ───────────────────────────────────────────────────────────── */

function demoSvg(kind = 'aurora') {
  const palettes = {
    aurora: { bg1: '#f3e8d8', bg2: '#e8d5bb', metal: '#3b2f26', glow: '#e9a54b', accent: '#c46b3d' },
    nube: { bg1: '#eee7db', bg2: '#ddd0bd', metal: '#4a3a2d', glow: '#f0b968', accent: '#8c7b63' },
    filo: { bg1: '#efe4d4', bg2: '#e2cdb2', metal: '#2f2823', glow: '#e49a3f', accent: '#b45b36' },
  };
  const p = palettes[kind] || palettes.aurora;
  const lamp = kind === 'nube'
    ? `<ellipse cx="600" cy="865" rx="210" ry="34" fill="${p.metal}" opacity=".18"/>
       <rect x="586" y="700" width="28" height="150" rx="14" fill="${p.metal}"/>
       <ellipse cx="600" cy="860" rx="150" ry="22" fill="${p.metal}"/>
       <circle cx="600" cy="590" r="190" fill="url(#shade)"/>
       <circle cx="600" cy="590" r="190" fill="none" stroke="${p.metal}" stroke-width="3" opacity=".55"/>
       <ellipse cx="600" cy="700" rx="62" ry="16" fill="${p.glow}" opacity=".9"/>`
    : kind === 'filo'
      ? `<line x1="600" y1="110" x2="600" y2="330" stroke="${p.metal}" stroke-width="5"/>
         <path d="M600 300 L800 500 L600 760 L400 500 Z" fill="url(#shade)" stroke="${p.metal}" stroke-width="3"/>
         <path d="M600 300 L600 760 M400 500 L800 500" stroke="${p.metal}" stroke-width="2" opacity=".35"/>
         <ellipse cx="600" cy="770" rx="120" ry="26" fill="${p.glow}" opacity=".55"/>`
      : `<line x1="600" y1="100" x2="600" y2="300" stroke="${p.metal}" stroke-width="5"/>
         <path d="M330 520 Q600 250 870 520 Q600 640 330 520 Z" fill="url(#shade)" stroke="${p.metal}" stroke-width="3"/>
         <path d="M390 505 Q600 330 810 505" fill="none" stroke="${p.glow}" stroke-width="6" opacity=".8"/>
         <path d="M450 520 Q600 420 750 520" fill="none" stroke="${p.accent}" stroke-width="3" opacity=".6"/>
         <ellipse cx="600" cy="600" rx="230" ry="40" fill="${p.glow}" opacity=".35"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" role="img" aria-label="Lámpara de ejemplo">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/>
    </linearGradient>
    <radialGradient id="shade" cx="42%" cy="35%" r="70%">
      <stop offset="0" stop-color="${p.glow}" stop-opacity=".95"/>
      <stop offset=".55" stop-color="${p.accent}" stop-opacity=".9"/>
      <stop offset="1" stop-color="${p.metal}" stop-opacity=".95"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${p.glow}" stop-opacity=".35"/>
      <stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope=".08"/></feComponentTransfer>
      <feComposite operator="over" in2="SourceGraphic"/>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <circle cx="${kind === 'filo' ? 720 : 600}" cy="${kind === 'nube' ? 590 : 560}" r="330" fill="url(#halo)" filter="url(#soft)"/>
  <g filter="url(#grain)">
    ${lamp}
  </g>
  <text x="72" y="1110" fill="${p.metal}" opacity=".55" font-family="Georgia, serif" font-size="26" letter-spacing="8">LUMBRE · EJEMPLO</text>
</svg>`;
}

/* ─────────────────────────────────────────────────────────────
   Semilla completa: 3 productos, 1 misión terminada, hilos, contenido
   ───────────────────────────────────────────────────────────── */

export async function seedDemo(store) {
  const existing = store.get('products').filter((p) => p.demo);
  if (existing.length) return { already: true, products: existing.length };

  const createdAt = new Date(Date.now() - 4 * 86400000).toISOString();
  const products = [
    {
      id: 'prod_demo_aurora',
      demo: true,
      code: 'AUR-01',
      name: 'Aurora 01',
      category: 'Lámpara colgante',
      price: 240,
      currency: 'USD',
      cost: 58,
      weightGrams: 1400,
      dimensions: 'Ø 32 cm × 28 cm, cable 180 cm',
      materials: 'PLA+ de proveedor local, portalámpara E27, cable textil',
      description: 'Colgante de geometría orgánica impreso en 3D. La pantalla proyecta una sombra en abanico sobre la pared. Luz cálida, ideal para comedores chicos y rincones de lectura.',
      notes: 'Se produce a pedido en 2 a 3 semanas. Colores disponibles: hueso, terracota y verde oliva.',
      photos: [{ file: 'demo/aurora.svg', alt: 'Aurora 01, lámpara colgante de ejemplo' }],
      status: 'listo',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'prod_demo_nube',
      demo: true,
      code: 'NUB-02',
      name: 'Nube',
      category: 'Lámpara de mesa',
      price: 145,
      currency: 'USD',
      cost: 34,
      weightGrams: 900,
      dimensions: 'Ø 24 cm × 38 cm',
      materials: 'PLA mate, difusor opalino, base estable',
      description: 'Lámpara de mesa esférica con difusor suave. Pensada para veladores y escritorios donde la luz directa molesta.',
      notes: 'Stock inmediato en hueso. Otros colores, 10 días.',
      photos: [{ file: 'demo/nube.svg', alt: 'Nube, lámpara de mesa de ejemplo' }],
      status: 'listo',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'prod_demo_filo',
      demo: true,
      code: 'FIL-03',
      name: 'Filo',
      category: 'Lámpara colgante',
      price: 320,
      currency: 'USD',
      cost: 76,
      weightGrams: 1800,
      dimensions: '40 × 40 × 60 cm, cable 200 cm',
      materials: 'PLA+ reforzado, estructura interna de aluminio, cable textil',
      description: 'Colgante geométrico de gran formato para halls y escaleras. La estructura de aluminio permite una pantalla de 40 cm sin deformación.',
      notes: 'Requiere punto de luz central. Producción de 3 semanas.',
      photos: [{ file: 'demo/filo.svg', alt: 'Filo, lámpara colgante geométrica de ejemplo' }],
      status: 'borrador',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  /* Guardamos las imágenes y usamos las rutas reales que devuelve el store,
     así las fotos de ejemplo se sirven desde /media/... sin 404. */
  for (const product of products) {
    const kind = { 'prod_demo_aurora': 'aurora', 'prod_demo_nube': 'nube', 'prod_demo_filo': 'filo' }[product.id];
    if (!kind) continue;
    const alt = product.photos?.[0]?.alt || `Lámpara ${kind} de ejemplo`;
    const saved = await store.saveMedia(Buffer.from(demoSvg(kind), 'utf8'), 'svg', 'demo', alt);
    product.photos = [saved];
  }

  const missionId = 'mis_demo_aurora';
  const mission = {
    id: missionId,
    demo: true,
    productId: products[0].id,
    name: 'Aurora 01 · España y México',
    goal: 'conseguir-mayoristas',
    markets: ['España', 'México', 'Estados Unidos'],
    depth: 'estandar',
    tone: 'cercano, experto, sin presión',
    budget: 80,
    maxProspects: 12,
    notes: 'Quiero probar tiendas de diseño y estudios de interiorismo. No quiero bajar el precio.',
    status: 'done',
    phase: 'finished',
    progress: 100,
    createdAt,
    startedAt: createdAt,
    finishedAt: new Date(Date.now() - 4 * 86400000 + 11 * 60000).toISOString(),
    summary: '',
    error: null,
    log: [
      { at: createdAt, text: 'Misión de ejemplo iniciada.' },
      { at: createdAt, text: 'Director Comercial: tesis definida.' },
      { at: createdAt, text: 'Analista de Mercado: 3 fuentes revisadas.' },
      { at: createdAt, text: 'Especialista en Aduanas: 3 países relevados.' },
      { at: createdAt, text: 'Cazador de Compradores: 12 compradores encontrados.' },
      { at: createdAt, text: 'Redactor Comercial: 12 mensajes personalizados, uno por comprador.' },
      { at: createdAt, text: 'Red team: 5 agujeros detectados.' },
      { at: createdAt, text: 'Plan final listo.' },
    ],
    steps: [],
    artifacts: {},
    stats: { calls: 10, tokens: 48210, prospects: 12, emails: 8 },
  };

  const ctx = {
    product: products[0],
    mission,
    brand: store.settings().brand,
    settings: store.settings(),
    artifacts: {},
  };
  for (const stepId of ['brief', 'research', 'customs', 'pricing', 'prospecting', 'enrichment', 'outreach', 'content', 'compliance', 'redteam', 'synthesis', 'learning']) {
    mission.artifacts[stepId] = demoStep(stepId, ctx);
    ctx.artifacts[stepId] = mission.artifacts[stepId];
  }
  mission.summary = mission.artifacts.synthesis.resumen;

  const agentByStep = {
    brief: 'director', research: 'mercado', customs: 'aduanas', pricing: 'precios',
    prospecting: 'cazador', enrichment: 'cazador', outreach: 'redactor', content: 'contenido',
    compliance: 'cumplimiento', redteam: 'redteam', synthesis: 'director', learning: 'memoria',
  };
  const titles = {
    brief: 'Brief y tesis comercial', research: 'Mercado y competencia', customs: 'Aduanas y logística',
    pricing: 'Precios y márgenes', prospecting: 'Compradores concretos', enrichment: 'Verificación de contactos',
    outreach: 'Mensajes de apertura', content: 'Contenido y narrativa', compliance: 'Cumplimiento y reputación',
    redteam: 'Red team', synthesis: 'Plan final para el dueño', learning: 'Aprendizajes',
  };
  const summaries = {
    brief: 'Tesis: pieza de luz escultórica para espacios pequeños, no lámpara decorativa.',
    research: '3 tendencias, 3 competidores y 3 canales priorizados.',
    customs: 'España, México y EE. UU. relevados con advertencias.',
    pricing: 'Directo 240, mayorista 156, galería 192.',
    prospecting: '12 compradores de ejemplo priorizados.',
    enrichment: '8 emails públicos de ejemplo; 4 sin contacto.',
    outreach: '12 mensajes personalizados (1:1) y secuencia de 3 pasos.',
    content: '7 piezas y una serie recurrente.',
    compliance: 'Veredicto: con cambios. 4 riesgos detectados.',
    redteam: 'Veredicto: ajustar. El riesgo es la capacidad y la certificación.',
    synthesis: 'Plan de 7 días enfocado en España.',
    learning: '4 aprendizajes guardados.',
  };
  let offset = 0;
  mission.steps = Object.keys(agentByStep).map((stepId, index) => {
    const start = new Date(Date.now() - 4 * 86400000 + offset).toISOString();
    offset += 35000 + index * 8000;
    const end = new Date(Date.now() - 4 * 86400000 + offset).toISOString();
    return {
      id: stepId,
      agent: agentByStep[stepId],
      title: titles[stepId],
      status: 'done',
      critical: ['brief', 'research', 'pricing', 'outreach', 'synthesis'].includes(stepId),
      startedAt: start,
      endedAt: end,
      durationMs: 35000 + index * 8000,
      summary: summaries[stepId],
      error: null,
      tokens: Math.round(2600 + index * 780),
    };
  });

  const threads = [];
  const prospects = mission.artifacts.prospecting.compradores;
  const messages = mission.artifacts.outreach.mensajes;

  function draftFor(prospect, index) {
    const msg = messages.find((m) => m.comprador === prospect.nombre);
    if (msg) {
      return {
        id: uid('drf'),
        channel: 'email',
        language: msg.idioma,
        subject: msg.asunto,
        body: msg.cuerpo.replace(/— .*$/s, `— ${store.settings().brand.maker || 'Lumbre'}\n${store.settings().brand.website || ''}\nSi preferís no recibir más mensajes, respondé BAJA.`),
        status: 'listo',
        guardVersion: 2,
        createdAt,
      };
    }
    return {
      id: uid('drf'),
      channel: 'formulario',
      language: 'es',
      subject: '',
      body: `Hola, vi la selección de ${prospect.nombre} y creo que ${products[0].name} puede encajar. ¿Les interesa que les mande la ficha con medidas y precio mayorista?`,
      status: 'listo',
      guardVersion: 2,
      createdAt,
    };
  }

  prospects.slice(0, 5).forEach((prospect, index) => {
    const stages = ['interesado', 'contactado', 'respondio', 'nuevo', 'nuevo'];
    const stage = stages[index] || 'nuevo';
    const thread = {
      id: `thr_demo_${index + 1}`,
      demo: true,
      missionId,
      productId: products[0].id,
      contact: {
        name: prospect.contacto || 'Equipo de compras',
        company: prospect.nombre,
        role: prospect.rol,
        email: prospect.email,
        emailStatus: prospect.email_estado,
        country: prospect.pais,
        city: prospect.ciudad,
        website: prospect.web,
        type: prospect.tipo,
      },
      stage,
      score: stage === 'interesado' ? 84 : stage === 'respondio' ? 72 : stage === 'contactado' ? 51 : 38,
      source: 'Misión Aurora 01',
      notes: index === 0 ? 'Pidió ver la ficha y preguntó por el plazo de producción. Buena señal.' : '',
      drafts: [draftFor(prospect, index)],
      messages: [],
      nextStep: stage === 'interesado' ? 'Responder con ficha, plazo y precio mayorista.' : stage === 'respondio' ? 'Responder la consulta de envío.' : stage === 'contactado' ? 'Seguimiento el día 4.' : 'Revisar el borrador y enviar.',
      nextFollowUp: addDays(new Date(), stage === 'nuevo' ? 1 : 4).toISOString(),
      lastActivityAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };

    if (index === 0) {
      thread.messages.push({
        id: uid('msg'), direction: 'out', channel: 'email', subject: messages[0].asunto,
        body: messages[0].cuerpo, at: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'enviado',
      });
      thread.messages.push({
        id: uid('msg'), direction: 'in', channel: 'email', subject: 'Re: Aurora 01',
        body: 'Hola, gracias por escribir. Nos interesa ver la ficha y saber el plazo de producción para 4 unidades. También nos gustaría saber si se puede personalizar el color de la pantalla. Saludos, Marta.',
        at: new Date(Date.now() - 2 * 86400000).toISOString(), status: 'recibido',
      });
      thread.drafts.push({
        id: uid('drf'), channel: 'email', language: 'es', subject: 'Re: Aurora 01 — ficha y plazos',
        body: `Hola Marta,\n\nGracias por responder. Te paso los datos concretos: la pantalla mide 32 cm de diámetro, el cable es de 180 cm y el plazo para 4 unidades es de 3 semanas desde la confirmación.\n\nEl precio mayorista es ${money(156, 'USD')} por unidad, sin envío, con un mínimo de 4. La pantalla se puede personalizar en hueso, terracota o verde oliva sin costo adicional; un color fuera de esa paleta tiene un extra del 12%.\n\nTe adjunto la ficha completa. Si te sirve, puedo reservar la producción de la primera serie para la semana que viene.\n\n— ${store.settings().brand.maker || 'Lumbre'}\nSi preferís no recibir más mensajes, respondé BAJA.`,
        status: 'listo', guardVersion: 2, createdAt: new Date(Date.now() - 86400000).toISOString(),
      });
      thread.lastActivityAt = new Date(Date.now() - 2 * 86400000).toISOString();
    }
    if (index === 1) {
      thread.messages.push({
        id: uid('msg'), direction: 'out', channel: 'email', subject: messages[1].asunto,
        body: messages[1].cuerpo, at: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'enviado',
      });
    }
    if (index === 2) {
      thread.messages.push({
        id: uid('msg'), direction: 'out', channel: 'email', subject: messages[2].asunto,
        body: messages[2].cuerpo, at: new Date(Date.now() - 3 * 86400000).toISOString(), status: 'enviado',
      });
      thread.messages.push({
        id: uid('msg'), direction: 'in', channel: 'email', subject: 'Re: Aurora 01',
        body: 'Thanks for reaching out. We like the shade. What would shipping to New York cost for one sample, and do you have UL certification? We cannot specify a fixture without it.',
        at: new Date(Date.now() - 86400000).toISOString(), status: 'recibido',
      });
      thread.notes = 'Pregunta por certificación UL. No prometer nada hasta confirmar.';
    }

    threads.push(thread);
  });

  const content = mission.artifacts.content.calendario.map((item, index) => ({
    id: uid('cnt'),
    demo: true,
    missionId,
    productId: products[0].id,
    platform: item.plataforma,
    format: item.formato,
    hook: item.gancho,
    script: item.guion,
    caption: item.caption,
    hashtags: item.hashtags,
    cta: item.cta,
    day: item.dia,
    status: index === 0 ? 'publicado' : 'idea',
    createdAt,
    updatedAt: createdAt,
  }));

  const learnings = mission.artifacts.learning.aprendizajes.map((item) => ({
    id: uid('lrn'),
    demo: true,
    missionId,
    scope: 'Aurora 01',
    insight: item.insight,
    evidence: item.evidencia,
    confidence: item.confianza,
    apply: item.aplicar,
    tag: item.etiqueta,
    pinned: item.etiqueta === 'precio',
    createdAt,
  }));

  const activity = [
    { id: uid('act'), type: 'reply', text: 'Luz de Autor respondió: pidió ficha y plazo para 4 unidades.', meta: { threadId: threads[0].id }, at: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: uid('act'), type: 'mission', text: 'Misión Aurora 01 completada: 12 compradores analizados y 5 conversaciones abiertas con borradores.', meta: { missionId, demo: true }, at: new Date(Date.now() - 4 * 86400000 + 12 * 60000).toISOString() },
    { id: uid('act'), type: 'content', text: '7 piezas de contenido listas para revisar.', meta: { missionId, demo: true }, at: new Date(Date.now() - 4 * 86400000 + 13 * 60000).toISOString() },
    { id: uid('act'), type: 'system', text: 'Se cargaron datos de ejemplo. Podés borrarlos desde Ajustes.', meta: { demo: true }, at: createdAt },
  ];

  store.get('products').unshift(...products);
  store.get('missions').unshift(mission);
  store.get('threads').unshift(...threads);
  store.get('content').unshift(...content);
  store.get('learnings').unshift(...learnings);
  store.get('activity').unshift(...activity);
  await Promise.all([
    store.set('products', store.get('products')),
    store.set('missions', store.get('missions')),
    store.set('threads', store.get('threads')),
    store.set('content', store.get('content')),
    store.set('learnings', store.get('learnings')),
    store.set('activity', store.get('activity')),
  ]);
  await store.saveSettings({ onboarding: { demoLoaded: true } });
  await store.activity('system', 'Datos de ejemplo cargados.', { demo: true });

  return { products: products.length, mission: 1, threads: threads.length, content: content.length, learnings: learnings.length };
}

export async function clearDemo(store) {
  const demoProducts = store.get('products').filter((p) => p.demo);
  for (const product of demoProducts) {
    for (const photo of product.photos || []) {
      if (photo.file?.startsWith('demo/')) await store.removeMedia(photo.file);
    }
  }
  const strip = (name) => {
    const list = store.get(name).filter((item) => !item.demo);
    store.set(name, list);
    return list;
  };
  strip('products');
  strip('missions');
  strip('threads');
  strip('content');
  strip('learnings');
  strip('suppressions');
  const activity = store.get('activity').filter((item) => !item.meta?.demo && !/ejemplo/i.test(item.text));
  store.set('activity', activity);
  await store.saveSettings({ onboarding: { demoLoaded: false } });
  await store.activity('system', 'Se borraron los datos de ejemplo.');
}

/* ─────────────────────────────────────────────────────────────
   Respuestas y consultas simuladas
   ───────────────────────────────────────────────────────────── */

export function demoReply(thread, brand = {}) {
  const last = [...(thread.messages || [])].reverse().find((m) => m.direction === 'in');
  const text = String(last?.body || '').toLowerCase();
  const no = Boolean(detectOptOut(text)) || /no gracias|no, gracias|no estamos interesados/i.test(text);
  return {
    intencion: no ? 'no_gracias' : /precio|costo|cuanto|cuánto|price|cost/.test(text) ? 'pide_precio' : /certific|ul|ce|norma/.test(text) ? 'objecion' : 'interesado',
    sentimiento: no ? 'negativo' : 'positivo',
    score: no ? 8 : /muestra|sample|ficha|plazo|precio/.test(text) ? 82 : 64,
    senales: no ? ['Pidió no recibir más mensajes.'] : ['Pregunta concreta sobre producto o condiciones.', 'No pidió retirarse.'],
    siguiente_paso: no ? 'Cerrar con dignidad y marcar como perdido.' : 'Responder con el dato exacto, una prueba y un único siguiente paso.',
    etapa: no ? 'perdido' : 'interesado',
    borrador: {
      asunto: no ? 'Listo, no vuelvo a escribir' : `Re: ${last?.subject || 'tu consulta'}`,
      cuerpo: no
        ? 'Gracias por avisar. No vuelvo a escribirte. Si en algún momento retomás el proyecto, la puerta queda abierta. Éxitos.'
        : `Hola,\n\nGracias por responder. Te paso el dato concreto: la pieza se produce a pedido en 3 semanas y el precio mayorista arranca en 4 unidades.\n\nTe adjunto la ficha con medidas y materiales. Si te sirve, te reservo un lugar en la próxima serie y te confirmo la fecha exacta.\n\n¿Querés que avancemos con una unidad de muestra?\n\n— ${brand?.maker || brand?.name || 'Lumbre'}`,
    },
    nota: 'Análisis simulado del modo demo. Configurá una IA para analizar la respuesta real.',
    demo: true,
  };
}

export function demoAsk(agentId, question) {
  const agent = agentId || 'director';
  const answers = {
    director: `Por lo que veo en tus datos, el cuello de botella no es el mensaje: es la prueba. Tenés un producto con un diferencial visual claro (la sombra) y un precio que necesita contexto.\n\nEsta semana haría tres cosas:\n1. Elegir un solo mercado y cinco compradores verificables.\n2. Armar una ficha de una página con medidas, materiales, plazo y precio mayorista.\n3. Ofrecer una unidad en consignación a dos tiendas antes de abrir otro país.\n\nNo abras México ni EE. UU. hasta resolver la certificación eléctrica. El resto es ruido.`,
    mercado: `La señal más fuerte es que las tiendas pequeñas compran series cortas y valoran una pieza que se explique rápido. El término que usaría es "lámpara de autor", no "impresión 3D": la tecnología es el cómo, no el beneficio.\n\nAntes de invertir en publicidad, miraría qué están vendiendo las tiendas que te interesan y a qué precio. Si todas tienen lámparas de 120 a 180 USD, tu precio de 240 necesita una razón visible (tamaño, sombra, personalización).`,
    aduanas: `Para España, si enviás desde fuera de la UE, necesitás CE, declaración de conformidad y etiquetado. El arancel depende del código HS (probablemente 9405.21) y el IVA es 21%.\n\nPara EE. UU., UL/ETL no es obligatorio para vender online, pero muchas tiendas no compran sin eso. Para México, NOM puede bloquear la venta formal.\n\nNo prometas "apto para todo el mundo". Confirmá el código HS y la certificación antes de cotizar.`,
    precios: `Con un costo de 58 USD y un precio de 240, tu margen directo es sano. El problema aparece en mayorista: 156 USD deja 82 USD antes de atención, rotura y devoluciones. Con 10% de pérdida, baja a unos 66 USD.\n\nNo bajes de 156. Si una tienda pide 30 unidades, pedí 50% de seña y escaloná la entrega. El descuento no debería superar el 10% y solo en la primera orden.`,
    cazador: `Priorizaría cinco tiendas de España con una Vidriera activa y un comprador identificable. No mandaría mensajes a "info@": buscá el nombre en LinkedIn o llamá y preguntá quién compra iluminación.\n\nLos estudios de interiorismo suelen responder mejor que las tiendas, porque compran por proyecto y no por rotación. Ofreceles una unidad de muestra con devolución en 30 días.`,
    redactor: `Tus mensajes mejoran cuando empiezan por algo que vimos, no por lo que somos. Cambiá "Soy maker y hago lámparas impresas en 3D" por "Vi la selección de tu tienda y creo que esta pieza puede encajar por la sombra que proyecta".\n\nUn solo pedido: permiso para enviar la ficha. Nada de adjuntos, links de pago ni "agendo una llamada de 15 minutos". La respuesta tiene que ser fácil de escribir con el pulgar.`,
    contenido: `La serie "una lámpara, siete luces" es la mejor idea porque demuestra versatilidad sin producir siete productos. Empezá con la sombra en la pared: es el único contenido que no se puede copiar con otra lámpara.\n\nEvitá los Reels de proceso de impresión sin contexto. El proceso interesa cuando ya hay deseo; primero vendé el objeto.`,
    cumplimiento: `No afirmes certificaciones que no tenés. En la UE, el marcado CE es obligatorio para luminarias y la declaración de conformidad es tu responsabilidad como fabricante/importador.\n\nEn los correos, incluí tu nombre, ciudad, web y una línea de baja. No uses listas compradas. Guardá solo los datos necesarios y borrá a quien lo pida.`,
    redteam: `El plan falla si asumís que una tienda va a arriesgar su dinero en una marca sin prueba. La certificación es el bloqueo real para EE. UU. y México, y la capacidad de producción es el bloqueo para pedidos grandes.\n\nProbá esto esta semana: enviá 5 correos, visitá 2 tiendas y ofrecé una unidad en consignación. Si no conseguís 2 conversaciones, el problema no es el precio: es el canal o la prueba.`,
    memoria: `Lo que más se repite en tus misiones es que el diferencial es visual, no tecnológico. Guardá eso: la próxima vez, la primera foto tiene que mostrar la sombra, no la impresora.\n\nEl segundo patrón es que el precio mayorista necesita un mínimo de 4 unidades para no comerse el margen. No lo cambies por cerrar una venta.`,
    analista: `La respuesta de Luz de Autor es una señal de compra, no una curiosidad: pidió plazo y personalización. Respondé hoy con el dato exacto y una sola pregunta.\n\nNo mandes un catálogo de 20 páginas. Mandá la ficha, el precio para 4 unidades y una fecha de producción. Si no tenés la fecha, decí cuándo la vas a confirmar.`,
  };
  return {
    answer: answers[agent] || answers.director,
    demo: true,
    note: 'Respuesta simulada del modo demo. Configurá una IA para consultas reales sobre tus datos.',
    question,
  };
}

export function demoMissionBundle(product = null, overrides = {}) {
  const settings = { brand: { name: 'Lumbre', maker: '', city: '', website: '' }, mission: { currency: 'USD' } };
  const ctx = {
    product: product || { name: 'Aurora 01', code: 'AUR-01', price: 240, currency: 'USD', cost: 58, description: '' },
    mission: { markets: ['España', 'México', 'Estados Unidos'], ...overrides },
    brand: settings.brand,
    settings,
    artifacts: {},
  };
  const artifacts = {};
  for (const stepId of ['brief', 'research', 'customs', 'pricing', 'prospecting', 'enrichment', 'outreach', 'content', 'compliance', 'redteam', 'synthesis', 'learning']) {
    artifacts[stepId] = demoStep(stepId, ctx);
    ctx.artifacts[stepId] = artifacts[stepId];
  }
  return artifacts;
}
