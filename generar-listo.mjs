import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const replacements = {
  appREPLACE_BASE_ID: 'appkk3JHBiWrBn4UF',
  tblREPLACE_PRODUCTOS: 'tblSrwh7WuhyRF0Na',
  tblREPLACE_LEADS: 'tblVP4FejuN0nCErl',
  tblREPLACE_OUTBOX: 'tbl3q20ESmqsdPZjW',
  tblREPLACE_CONVERSACIONES: 'tblBqsUvph5L7wYH4',
  tblREPLACE_CONTENIDO: 'tblfaoGBqyqmmsKYw',
  tblREPLACE_CONFIG: 'tblYQ2OYheotsKmSo',
  tblREPLACE_METRICAS: 'tblelh0iXLt1gWKwN',
  tblREPLACE_APRENDIZAJES: 'tbl3levRw5w1Dwpws'
};

const configSeed = [
  ['marca', 'COMPLETAR: nombre de tu marca'],
  ['web', 'COMPLETAR: URL de tu web o Instagram'],
  ['email_remitente', 'COMPLETAR: email desde el que envias'],
  ['firma', 'COMPLETAR: nombre, cargo, telefono y web'],
  ['direccion_fisica', 'COMPLETAR: direccion postal para la firma (obligatoria para CAN-SPAM)'],
  ['pais_base', 'Argentina'],
  ['moneda_base', 'USD'],
  ['idiomas', 'es,en,pt'],
  ['modo_envio', 'manual'],
  ['limite_borradores_por_ciclo', '3'],
  ['limite_envios_por_dia', '15'],
  ['limite_seguimientos', '2'],
  ['dias_entre_seguimientos', '4'],
  ['nichos_prioritarios', 'estudios de interiorismo, arquitectura, hoteles boutique, restaurantes de diseno, coworkings premium, regalos corporativos'],
  ['paises_prioritarios', 'Argentina, Chile, Uruguay, Mexico, Espana, Estados Unidos'],
  ['propuesta_valor', 'COMPLETAR: que hace unica a tu lampara (material, diseno, personalizacion, plazo)'],
  ['publico_prioritario', 'interioristas, arquitectos, hoteles, restaurantes, retail de diseno y regalos corporativos'],
  ['no_afirmar', 'No inventar certificaciones, clientes, stock, plazos ni precios. No prometer envios internacionales sin confirmar logistica.'],
  ['horario_reporte', '09:00 America/Argentina/Buenos_Aires'],
  ['aprobacion', 'El dueno aprueba cada correo en Airtable antes del envio.'],
  ['version_sistema', '1.0']
];

const productHeaders = [
  'Producto', 'SKU', 'Estado', 'Descripcion_corta', 'Descripcion_larga', 'Precio', 'Moneda',
  'Material', 'Medidas', 'Colores', 'Lead_time_dias', 'Capacidad_semanal', 'Link_ficha',
  'Nicho_ideal', 'Paises_objetivo', 'Argumentos_venta'
];

const productRow = [
  'Producto de ejemplo - editar o borrar', 'EJEMPLO-001', 'Borrador',
  'Lampara de autor impresa en 3D. Edita este registro con tu primer producto real.',
  'Reemplaza esta descripcion por la de tu producto: material, medidas, colores, uso recomendado y argumentos de venta.',
  '0', 'USD', 'PLA / PETG', 'Completar', 'Completar', '7', '5', 'https://example.com',
  'Interiorismo, hoteles boutique, regalos corporativos', 'Argentina, Chile, Mexico, Espana',
  'Diseno propio, fabricacion local, personalizacion de color y medidas.'
];

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')}\r\n`;
}

const files = (await readdir(ROOT)).filter((file) => file.endsWith('.blueprint.json') && !file.startsWith('LISTO-'));
for (const file of files) {
  const raw = await readFile(path.join(ROOT, file), 'utf8');
  let patched = raw;
  for (const [from, to] of Object.entries(replacements)) {
    patched = patched.split(from).join(to);
  }
  if (patched.includes('REPLACE_')) throw new Error(`${file} tiene placeholders sin reemplazar`);
  JSON.parse(patched);
  const output = path.join(ROOT, `LISTO-${file}`);
  await writeFile(output, patched, 'utf8');
  console.log(`Generado ${path.basename(output)}`);
}

await writeFile(path.join(ROOT, 'config.csv'), toCsv([['Clave', 'Valor'], ...configSeed]), 'utf8');
await writeFile(path.join(ROOT, 'producto-ejemplo.csv'), toCsv([productHeaders, productRow]), 'utf8');
console.log('Generado config.csv');
console.log('Generado producto-ejemplo.csv');
