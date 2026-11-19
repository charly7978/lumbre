/* Directorio semilla de compradores reales.

   Por quÃ© existe: la bÃºsqueda web sin clave depende de instancias pÃºblicas
   que limitan consultas. Si la bÃºsqueda falla, una misiÃ³n no puede quedarse
   sin compradores ni inventarlos. Este directorio aporta tiendas reales con
   sitio web propio; la misiÃ³n las verifica igual que a cualquier candidato
   (fetch del sitio, coincidencia de nombre, email solo si estÃ¡ publicado) y
   descarta las que no respondan. No hay emails escritos a mano: se descubren
   en el sitio en el paso de enriquecimiento.

   Fecha de verificaciÃ³n de los sitios: 2026-11-19. Cada entrada fue
   comprobada con fetch real y coincidencia de nombre. */

export const SEED_BUYERS = [
  {
    nombre: 'Ideas Luz',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Madrid',
    web: 'https://www.ideasluz.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminaciÃ³n y lÃ¡mparas de diseÃ±o con local en Madrid; trabaja varias marcas y piezas de autor.',
  },
  {
    nombre: 'AÃ±os Luz',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Madrid',
    web: 'https://anosluziluminacion.com/es/',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Referente de iluminaciÃ³n de diseÃ±o en Madrid (Serrano); asesora proyectos residenciales y comerciales.',
  },
  {
    nombre: 'Avanluce',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://www.avanluce.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminaciÃ³n de diseÃ±o con showroom en Barcelona y catÃ¡logo multimarca.',
  },
  {
    nombre: 'Insolit BCN',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://www.insolitbcn.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda especializada en lÃ¡mparas de diseÃ±o en Barcelona, con marcas de autor y ediciones.',
  },
  {
    nombre: 'LÃ¡mparas Barcelona',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://lamparasbarcelona.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda online y showroom de lÃ¡mparas de diseÃ±o en Barcelona.',
  },
  {
    nombre: 'La Maison Barcelona',
    tipo: 'concept store',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://lamaisonbarcelona.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Concept store de decoraciÃ³n y proyectos de interiorismo; mezcla mobiliario, objetos e iluminaciÃ³n.',
  },
  {
    nombre: 'Mar de Cava',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://mardecava.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Muebles y decoraciÃ³n de diseÃ±o en Barcelona; incluye iluminaciÃ³n en su selecciÃ³n.',
  },
  {
    nombre: 'Pilight Shop',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://www.pilight.es',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminaciÃ³n de diseÃ±o con venta online y atenciÃ³n a proyectos.',
  },
  {
    nombre: 'MINIM',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://www.minim.es',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Retailer de mobiliario e iluminaciÃ³n de diseÃ±o contemporÃ¡neo con tiendas en Barcelona y Madrid.',
  },
  {
    nombre: 'Barcelona LED',
    tipo: 'tienda',
    pais: 'EspaÃ±a',
    ciudad: 'Barcelona',
    web: 'https://www.barcelonaled.com',
    prioridad: 'baja',
    verificado_at: '2026-11-19',
    por_que: 'Retail de iluminaciÃ³n LED: no encaja con una lÃ¡mpara de diseÃ±o de $35 (encaje bajo).',
  },
  {
    nombre: 'IluminaciÃ³n AgÃ¼ero',
    tipo: 'tienda',
    pais: 'Argentina',
    ciudad: 'Buenos Aires',
    web: 'https://iluminacionaguero.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'MÃ¡s de 60 aÃ±os en Recoleta; representa marcas internacionales de diseÃ±o y trabaja con estudios de arquitectura.',
  },
  {
    nombre: 'GA IluminaciÃ³n',
    tipo: 'tienda',
    pais: 'Argentina',
    ciudad: 'Buenos Aires',
    web: 'https://gailuminacion.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Casa de iluminaciÃ³n en Buenos Aires con catÃ¡logo de diseÃ±o y proyectos.',
  },
  {
    nombre: 'Scultura Luminosa',
    tipo: 'showroom',
    pais: 'MÃ©xico',
    ciudad: 'Ciudad de MÃ©xico',
    web: 'https://sculturaluminosa.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Showroom de iluminaciÃ³n de diseÃ±o en Polanco; atiende proyectos residenciales y de hospitalidad.',
  },
  {
    nombre: 'Diez Company',
    tipo: 'showroom',
    pais: 'MÃ©xico',
    ciudad: 'Ciudad de MÃ©xico',
    web: 'https://diezcompany.mx',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Showroom de diseÃ±o de iluminaciÃ³n de lujo en Polanco, con atenciÃ³n a arquitectos y proyectos.',
  },
  {
    nombre: 'Interlight',
    tipo: 'tienda',
    pais: 'Chile',
    ciudad: 'Santiago',
    web: 'https://interlight.cl',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminaciÃ³n de diseÃ±o con mÃ¡s de 40 aÃ±os en Chile; vende al detalle y a proyectos inmobiliarios.',
  },
  {
    nombre: 'Luminaire',
    tipo: 'tienda',
    pais: 'Estados Unidos',
    ciudad: 'Miami',
    web: 'https://www.luminaire.com',
    prioridad: 'baja',
    verificado_at: '2026-11-19',
    por_que: 'Showroom de lujo: probablemente no compre a un maker sin certificaciÃ³n (encaje bajo).',
  },
];

const MARKET_ALIASES = {
  espana: ['espana', 'spain', 'espaÃ±a'],
  mexico: ['mexico', 'mÃ©xico', 'mx'],
  'estados unidos': ['estados unidos', 'united states', 'usa', 'ee uu', 'eeuu', 'us'],
  argentina: ['argentina', 'ar'],
  chile: ['chile', 'cl'],
  colombia: ['colombia', 'co'],
  uruguay: ['uruguay', 'uy'],
  brasil: ['brasil', 'brazil', 'br'],
  peru: ['peru', 'perÃº', 'pe'],
  'reino unido': ['reino unido', 'united kingdom', 'uk', 'england'],
  francia: ['francia', 'france', 'fr'],
  alemania: ['alemania', 'germany', 'de'],
  italia: ['italia', 'italy', 'it'],
  portugal: ['portugal', 'pt'],
  canada: ['canada', 'canadÃ¡', 'ca'],
  australia: ['australia', 'au'],
};

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function marketMatchers(market) {
  const key = normalize(market);
  if (!key) return [];
  const aliases = MARKET_ALIASES[key] || [key];
  return [key, ...aliases.map(normalize)];
}

export function candidatesForMarkets(markets = []) {
  const matchers = new Set((markets || []).flatMap((market) => marketMatchers(market)));
  if (!matchers.size) return [];
  return SEED_BUYERS
    .filter((buyer) => matchers.has(normalize(buyer.pais)))
    .map((buyer) => ({
      ...buyer,
      email: '',
      email_estado: 'desconocido',
      origen: 'directorio',
      fuente: 'directorio semilla de Lumbre (sitios verificados en 2026-11-19)',
    }));
}

export function directorySize() {
  return SEED_BUYERS.length;
}
