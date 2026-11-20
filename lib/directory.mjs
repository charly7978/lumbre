/* Directorio semilla de compradores reales.

   Por qué existe: la búsqueda web sin clave depende de instancias públicas
   que limitan consultas. Si la búsqueda falla, una misión no puede quedarse
   sin compradores ni inventarlos. Este directorio aporta tiendas reales con
   sitio web propio; la misión las verifica igual que a cualquier candidato
   (fetch del sitio, coincidencia de nombre, email solo si está publicado) y
   descarta las que no respondan. No hay emails escritos a mano: se descubren
   en el sitio en el paso de enriquecimiento.

   Fecha de verificación de los sitios: 2026-11-19. Cada entrada fue
   comprobada con fetch real y coincidencia de nombre. */

export const SEED_BUYERS = [
  {
    nombre: 'Ideas Luz',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Madrid',
    web: 'https://www.ideasluz.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminación y lámparas de diseño con local en Madrid; trabaja varias marcas y piezas de autor.',
  },
  {
    nombre: 'Años Luz',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Madrid',
    web: 'https://anosluziluminacion.com/es/',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Referente de iluminación de diseño en Madrid (Serrano); asesora proyectos residenciales y comerciales.',
  },
  {
    nombre: 'Avanluce',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://www.avanluce.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminación de diseño con showroom en Barcelona y catálogo multimarca.',
  },
  {
    nombre: 'Insolit BCN',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://www.insolitbcn.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda especializada en lámparas de diseño en Barcelona, con marcas de autor y ediciones.',
  },
  {
    nombre: 'Lámparas Barcelona',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://lamparasbarcelona.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda online y showroom de lámparas de diseño en Barcelona.',
  },
  {
    nombre: 'La Maison Barcelona',
    tipo: 'concept store',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://lamaisonbarcelona.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Concept store de decoración y proyectos de interiorismo; mezcla mobiliario, objetos e iluminación.',
  },
  {
    nombre: 'Mar de Cava',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://mardecava.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Muebles y decoración de diseño en Barcelona; incluye iluminación en su selección.',
  },
  {
    nombre: 'Pilight Shop',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://www.pilight.es',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminación de diseño con venta online y atención a proyectos.',
  },
  {
    nombre: 'MINIM',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://www.minim.es',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Retailer de mobiliario e iluminación de diseño contemporáneo con tiendas en Barcelona y Madrid.',
  },
  {
    nombre: 'Barcelona LED',
    tipo: 'tienda',
    pais: 'España',
    ciudad: 'Barcelona',
    web: 'https://www.barcelonaled.com',
    prioridad: 'baja',
    verificado_at: '2026-11-19',
    por_que: 'Retail de iluminación LED: no encaja con una lámpara de diseño de $35 (encaje bajo).',
  },
  {
    nombre: 'Iluminación Agüero',
    tipo: 'tienda',
    pais: 'Argentina',
    ciudad: 'Buenos Aires',
    web: 'https://iluminacionaguero.com',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Más de 60 años en Recoleta; representa marcas internacionales de diseño y trabaja con estudios de arquitectura.',
  },
  {
    nombre: 'GA Iluminación',
    tipo: 'tienda',
    pais: 'Argentina',
    ciudad: 'Buenos Aires',
    web: 'https://gailuminacion.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Casa de iluminación en Buenos Aires con catálogo de diseño y proyectos.',
  },
  {
    nombre: 'Scultura Luminosa',
    tipo: 'showroom',
    pais: 'México',
    ciudad: 'Ciudad de México',
    web: 'https://sculturaluminosa.com',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Showroom de iluminación de diseño en Polanco; atiende proyectos residenciales y de hospitalidad.',
  },
  {
    nombre: 'Diez Company',
    tipo: 'showroom',
    pais: 'México',
    ciudad: 'Ciudad de México',
    web: 'https://diezcompany.mx',
    prioridad: 'media',
    verificado_at: '2026-11-19',
    por_que: 'Showroom de diseño de iluminación de lujo en Polanco, con atención a arquitectos y proyectos.',
  },
  {
    nombre: 'Interlight',
    tipo: 'tienda',
    pais: 'Chile',
    ciudad: 'Santiago',
    web: 'https://interlight.cl',
    prioridad: 'alta',
    verificado_at: '2026-11-19',
    por_que: 'Tienda de iluminación de diseño con más de 40 años en Chile; vende al detalle y a proyectos inmobiliarios.',
  },
  {
    nombre: 'Luminaire',
    tipo: 'tienda',
    pais: 'Estados Unidos',
    ciudad: 'Miami',
    web: 'https://www.luminaire.com',
    prioridad: 'baja',
    verificado_at: '2026-11-19',
    por_que: 'Showroom de lujo: probablemente no compre a un maker sin certificación (encaje bajo).',
  },
];

const MARKET_ALIASES = {
  espana: ['espana', 'spain', 'españa'],
  mexico: ['mexico', 'méxico', 'mx'],
  'estados unidos': ['estados unidos', 'united states', 'usa', 'ee uu', 'eeuu', 'us'],
  argentina: ['argentina', 'ar'],
  chile: ['chile', 'cl'],
  colombia: ['colombia', 'co'],
  uruguay: ['uruguay', 'uy'],
  brasil: ['brasil', 'brazil', 'br'],
  peru: ['peru', 'perú', 'pe'],
  'reino unido': ['reino unido', 'united kingdom', 'uk', 'england'],
  francia: ['francia', 'france', 'fr'],
  alemania: ['alemania', 'germany', 'de'],
  italia: ['italia', 'italy', 'it'],
  portugal: ['portugal', 'pt'],
  canada: ['canada', 'canadá', 'ca'],
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
