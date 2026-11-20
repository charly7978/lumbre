import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.AIRTABLE_API_BASE || 'https://api.airtable.com';
const API = `${API_BASE}/v0`;
const META = `${API_BASE}/v0/meta`;
const BASE_NAME = 'Ventas Lamparas 3D';

const TOKENS = {
  base: 'appREPLACE_BASE_ID',
  tables: {
    Productos: 'tblREPLACE_PRODUCTOS',
    Leads: 'tblREPLACE_LEADS',
    Outbox: 'tblREPLACE_OUTBOX',
    Conversaciones: 'tblREPLACE_CONVERSACIONES',
    Contenido: 'tblREPLACE_CONTENIDO',
    Config: 'tblREPLACE_CONFIG',
    Metricas: 'tblREPLACE_METRICAS',
    Aprendizajes: 'tblREPLACE_APRENDIZAJES'
  }
};

const schema = [
  {
    name: 'Productos',
    description: 'Catalogo de lamparas y productos activos. Carga aqui foto, precio, descripcion y argumentos.',
    fields: [
      { name: 'Producto', type: 'singleLineText' },
      { name: 'SKU', type: 'singleLineText' },
      { name: 'Estado', type: 'singleSelect', options: { choices: ['Activo', 'Pausado', 'Agotado', 'Borrador'].map((name) => ({ name })) } },
      { name: 'Descripcion_corta', type: 'singleLineText' },
      { name: 'Descripcion_larga', type: 'multilineText' },
      { name: 'Precio', type: 'currency', options: { precision: 2, symbol: '$' } },
      { name: 'Moneda', type: 'singleSelect', options: { choices: ['USD', 'EUR', 'ARS', 'MXN', 'CLP', 'COP', 'PEN', 'BRL'].map((name) => ({ name })) } },
      { name: 'Material', type: 'singleLineText' },
      { name: 'Medidas', type: 'singleLineText' },
      { name: 'Colores', type: 'singleLineText' },
      { name: 'Lead_time_dias', type: 'number', options: { precision: 0 } },
      { name: 'Capacidad_semanal', type: 'number', options: { precision: 0 } },
      { name: 'Fotos', type: 'multipleAttachments' },
      { name: 'Link_ficha', type: 'url' },
      { name: 'Nicho_ideal', type: 'singleLineText' },
      { name: 'Paises_objetivo', type: 'singleLineText' },
      { name: 'Argumentos_venta', type: 'multilineText' }
    ]
  },
  {
    name: 'Leads',
    description: 'Empresas y personas investigadas. Un registro por dominio o contacto.',
    fields: [
      { name: 'Lead', type: 'singleLineText' },
      { name: 'Tipo', type: 'singleSelect', options: { choices: ['Empresa', 'Particular', 'Estudio', 'Hotel', 'Restaurante', 'Retail', 'Evento', 'Otro'].map((name) => ({ name })) } },
      { name: 'Dominio', type: 'singleLineText' },
      { name: 'Web', type: 'url' },
      { name: 'Pais', type: 'singleLineText' },
      { name: 'Ciudad', type: 'singleLineText' },
      { name: 'Idioma', type: 'singleSelect', options: { choices: ['es', 'en', 'pt', 'fr', 'it', 'de', 'otro'].map((name) => ({ name })) } },
      { name: 'Nicho', type: 'singleLineText' },
      { name: 'Producto_interes', type: 'singleLineText' },
      { name: 'Fuente_URL', type: 'url' },
      { name: 'Senal', type: 'multilineText' },
      { name: 'Score', type: 'number', options: { precision: 0 } },
      { name: 'Estado', type: 'singleSelect', options: { choices: ['Nuevo', 'Investigado', 'Contactado', 'Respondio', 'Calificado', 'Propuesta', 'Negociacion', 'Ganado', 'Perdido', 'Descartado', 'OptOut'].map((name) => ({ name })) } },
      { name: 'Contacto_nombre', type: 'singleLineText' },
      { name: 'Contacto_cargo', type: 'singleLineText' },
      { name: 'Contacto_email', type: 'email' },
      { name: 'Email_estado', type: 'singleSelect', options: { choices: ['pending', 'valid', 'risky', 'invalid', 'unknown'].map((name) => ({ name })) } },
      { name: 'Fecha_alta', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
      { name: 'Ultimo_contacto', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
      { name: 'Proximo_paso', type: 'singleLineText' },
      { name: 'Notas', type: 'multilineText' }
    ]
  },
  {
    name: 'Outbox',
    description: 'Mesa de salida. Todo correo nace como borrador y se envia solo cuando el dueno lo aprueba.',
    fields: [
      { name: 'Asunto', type: 'singleLineText' },
      { name: 'Lead', type: 'singleLineText' },
      { name: 'Para', type: 'email' },
      { name: 'Nombre_destinatario', type: 'singleLineText' },
      { name: 'Cuerpo_HTML', type: 'multilineText' },
      { name: 'Idioma', type: 'singleLineText' },
      { name: 'Producto', type: 'singleLineText' },
      { name: 'Paso', type: 'number', options: { precision: 0 } },
      { name: 'Estado', type: 'singleSelect', options: { choices: ['Borrador', 'En_revision', 'Aprobado', 'Programado', 'Enviado', 'Error', 'Respondido', 'Cancelado'].map((name) => ({ name })) } },
      { name: 'Programado_para', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
      { name: 'Enviado_en', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
      { name: 'Message_ID', type: 'singleLineText' },
      { name: 'Respondido', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
      { name: 'Notas', type: 'multilineText' }
    ]
  },
  {
    name: 'Conversaciones',
    description: 'Mesa de entrada. Cada respuesta se clasifica y se prepara una respuesta para aprobacion.',
    fields: [
      { name: 'Asunto', type: 'singleLineText' },
      { name: 'Lead', type: 'singleLineText' },
      { name: 'Contacto', type: 'singleLineText' },
      { name: 'Email', type: 'email' },
      { name: 'Canal', type: 'singleSelect', options: { choices: ['Email', 'Telegram', 'Instagram', 'WhatsApp', 'Otro'].map((name) => ({ name })) } },
      { name: 'Direccion', type: 'singleSelect', options: { choices: ['Entrante', 'Saliente'].map((name) => ({ name })) } },
      { name: 'Clasificacion', type: 'singleSelect', options: { choices: ['Interesado', 'Pide_precio', 'Pide_catalogo', 'Objecion', 'No_interesado', 'OptOut', 'Spam', 'Socio', 'Otro'].map((name) => ({ name })) } },
      { name: 'Sentimiento', type: 'singleSelect', options: { choices: ['Positivo', 'Neutral', 'Negativo'].map((name) => ({ name })) } },
      { name: 'Resumen', type: 'multilineText' },
      { name: 'Mensaje_original', type: 'multilineText' },
      { name: 'Borrador_respuesta', type: 'multilineText' },
      { name: 'Estado', type: 'singleSelect', options: { choices: ['Pendiente', 'Aprobada', 'Enviada', 'Cerrada'].map((name) => ({ name })) } },
      { name: 'Fecha', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
      { name: 'Message_ID', type: 'singleLineText' },
      { name: 'Notas', type: 'multilineText' }
    ]
  },
  {
    name: 'Contenido',
    description: 'Calendario de contenido organico. Las piezas se aprueban antes de publicar.',
    fields: [
      { name: 'Titulo', type: 'singleLineText' },
      { name: 'Plataforma', type: 'singleSelect', options: { choices: ['Instagram', 'TikTok', 'Pinterest', 'LinkedIn', 'Facebook', 'YouTube', 'Blog', 'Email'].map((name) => ({ name })) } },
      { name: 'Formato', type: 'singleSelect', options: { choices: ['Reel', 'Carrusel', 'Foto', 'Historia', 'Post', 'Video', 'Articulo', 'Newsletter'].map((name) => ({ name })) } },
      { name: 'Gancho', type: 'singleLineText' },
      { name: 'Copy', type: 'multilineText' },
      { name: 'Hashtags', type: 'singleLineText' },
      { name: 'CTA', type: 'singleLineText' },
      { name: 'Producto', type: 'singleLineText' },
      { name: 'Estado', type: 'singleSelect', options: { choices: ['Idea', 'Borrador', 'En_revision', 'Aprobado', 'Programado', 'Publicado', 'Descartado'].map((name) => ({ name })) } },
      { name: 'Fecha_publicacion', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
      { name: 'Metricas', type: 'multilineText' },
      { name: 'Aprendizaje', type: 'multilineText' }
    ]
  },
  {
    name: 'Config',
    description: 'Configuracion operativa de la marca. Los agentes leen esta tabla al inicio de cada ciclo.',
    fields: [
      { name: 'Clave', type: 'singleLineText' },
      { name: 'Valor', type: 'multilineText' }
    ]
  },
  {
    name: 'Metricas',
    description: 'Metricas diarias para aprender y ajustar el sistema.',
    fields: [
      { name: 'Fecha', type: 'singleLineText' },
      { name: 'Leads_nuevos', type: 'number', options: { precision: 0 } },
      { name: 'Emails_enviados', type: 'number', options: { precision: 0 } },
      { name: 'Respuestas', type: 'number', options: { precision: 0 } },
      { name: 'Respuestas_positivas', type: 'number', options: { precision: 0 } },
      { name: 'Reuniones', type: 'number', options: { precision: 0 } },
      { name: 'Propuestas', type: 'number', options: { precision: 0 } },
      { name: 'Ventas', type: 'number', options: { precision: 0 } },
      { name: 'Ingresos', type: 'number', options: { precision: 2 } },
      { name: 'Notas', type: 'multilineText' }
    ]
  },
  {
    name: 'Aprendizajes',
    description: 'Patrones comerciales validados con evidencia. Alimentan el proximo ciclo.',
    fields: [
      { name: 'Hallazgo', type: 'singleLineText' },
      { name: 'Fecha', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
      { name: 'Fuente', type: 'singleLineText' },
      { name: 'Evidencia', type: 'multilineText' },
      { name: 'Accion', type: 'multilineText' },
      { name: 'Agente', type: 'singleSelect', options: { choices: ['Comercial', 'Marketing', 'Respuestas'].map((name) => ({ name })) } }
    ]
  }
];

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

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function api(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers || {}) }
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const message = data.error?.message || data.error || data.raw || response.statusText;
    const details = data.error?.details ? ` ${JSON.stringify(data.error.details)}` : '';
    throw new Error(`${response.status} ${message}${details}`);
  }
  return data;
}

function replaceTokens(text, replacements) {
  let output = text;
  for (const [from, to] of Object.entries(replacements)) {
    output = output.split(from).join(to);
  }
  return output;
}

async function validateBlueprints() {
  const files = (await readdir(ROOT)).filter((f) => f.endsWith('.blueprint.json') && !f.startsWith('LISTO-'));
  if (!files.length) throw new Error('No hay blueprints para validar. Ejecuta build-blueprints.mjs.');
  const replacements = {
    [TOKENS.base]: 'appVALIDATION000000',
    ...Object.fromEntries(Object.entries(TOKENS.tables).map(([name, token], i) => [token, `tblVALIDATION${String(i).padStart(4, '0')}`]))
  };
  for (const file of files) {
    const raw = await readFile(path.join(ROOT, file), 'utf8');
    const patched = replaceTokens(raw, replacements);
    JSON.parse(patched);
    if (patched.includes('REPLACE_')) throw new Error(`${file} contiene tokens sin reemplazar`);
    console.log(`OK ${file}`);
  }
}

async function createBase(token, workspaceId) {
  const payload = {
    name: BASE_NAME,
    workspaceId,
    tables: schema
  };
  return api(`${META}/bases`, token, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function seedConfig(token, baseId, configTableId) {
  const records = configSeed.map(([Clave, Valor]) => ({ fields: { Clave, Valor } }));
  for (let i = 0; i < records.length; i += 10) {
    await api(`${API}/${baseId}/${configTableId}`, token, {
      method: 'POST',
      body: JSON.stringify({ records: records.slice(i, i + 10), typecast: true })
    });
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
}

async function seedProduct(token, baseId, productsTableId) {
  const record = {
    fields: {
      Producto: 'Producto de ejemplo - editar o borrar',
      SKU: 'EJEMPLO-001',
      Estado: 'Borrador',
      Descripcion_corta: 'Lampara de autor impresa en 3D. Edita este registro con tu primer producto real.',
      Descripcion_larga: 'Reemplaza esta descripcion por la de tu producto: material, medidas, colores, uso recomendado y argumentos de venta.',
      Precio: 0,
      Moneda: 'USD',
      Material: 'PLA / PETG',
      Medidas: 'Completar',
      Colores: 'Completar',
      Lead_time_dias: 7,
      Capacidad_semanal: 5,
      Link_ficha: 'https://example.com',
      Nicho_ideal: 'Interiorismo, hoteles boutique, regalos corporativos',
      Paises_objetivo: 'Argentina, Chile, Mexico, Espana',
      Argumentos_venta: 'Diseno propio, fabricacion local, personalizacion de color y medidas.'
    }
  };
  await api(`${API}/${baseId}/${productsTableId}`, token, {
    method: 'POST',
    body: JSON.stringify({ records: [record], typecast: true })
  });
}

async function patchBlueprints(baseId, tableIds) {
  const files = (await readdir(ROOT)).filter((f) => f.endsWith('.blueprint.json') && !f.startsWith('LISTO-'));
  const replacements = { [TOKENS.base]: baseId };
  for (const [name, token] of Object.entries(TOKENS.tables)) {
    if (!tableIds[name]) throw new Error(`Falta la tabla ${name} en la respuesta de Airtable`);
    replacements[token] = tableIds[name];
  }
  const written = [];
  for (const file of files) {
    const raw = await readFile(path.join(ROOT, file), 'utf8');
    const patched = replaceTokens(raw, replacements);
    JSON.parse(patched);
    if (patched.includes('REPLACE_')) throw new Error(`${file} contiene tokens sin reemplazar`);
    const out = path.join(ROOT, `LISTO-${file}`);
    await writeFile(out, patched, 'utf8');
    written.push(path.basename(out));
  }
  return written;
}

async function listTables(token, baseId) {
  const data = await api(`${META}/bases/${baseId}/tables`, token);
  return data.tables || [];
}

async function createTablesInExistingBase(token, baseId) {
  await api(`${META}/whoami`, token);
  const existing = await listTables(token, baseId);
  const tableIds = Object.fromEntries(existing.map((table) => [table.name, table.id]));
  for (const table of schema) {
    if (tableIds[table.name]) {
      console.log(`  Tabla existente: ${table.name} (${tableIds[table.name]})`);
      continue;
    }
    const created = await api(`${META}/bases/${baseId}/tables`, token, {
      method: 'POST',
      body: JSON.stringify({ name: table.name, description: table.description, fields: table.fields })
    });
    tableIds[table.name] = created.id;
    console.log(`  Tabla creada: ${table.name} (${created.id})`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return tableIds;
}

async function chooseBase(token) {
  const data = await api(`${META}/bases`, token);
  const bases = data.bases || [];
  if (!bases.length) {
    throw new Error('No encontre bases accesibles con este token. Crea una base en Airtable (+ Create > Build an app on your own) o revisa el acceso del token.');
  }
  const targetName = (process.env.AIRTABLE_BASE_NAME || BASE_NAME).toLowerCase();
  const named = bases.find((base) => base.name.toLowerCase() === targetName);
  if (named) return named;
  if (bases.length === 1) return bases[0];

  console.log('Bases disponibles:');
  bases.forEach((base, index) => {
    console.log(`  ${index + 1}. ${base.name} (${base.id})`);
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Elegi el numero de la base (Enter = 1): ');
  rl.close();
  const index = answer.trim() ? Number(answer.trim()) - 1 : 0;
  if (!Number.isInteger(index) || index < 0 || index >= bases.length) {
    throw new Error('Numero de base invalido.');
  }
  return bases[index];
}

async function main() {
  const validateOnly = process.argv.includes('--validate');
  if (validateOnly) {
    await validateBlueprints();
    return;
  }

  const token = process.env.AIRTABLE_TOKEN;
  let baseId = process.env.AIRTABLE_BASE_ID;
  const workspaceId = process.env.AIRTABLE_WORKSPACE_ID;
  if (!token) {
    console.error('Falta el token de Airtable.');
    console.error('Ejecuta CONFIGURAR.cmd para hacerlo de forma guiada.');
    process.exit(1);
  }

  if (!baseId && !workspaceId) {
    const chosen = await chooseBase(token);
    baseId = chosen.id;
    console.log(`Usando base: ${chosen.name} (${baseId})`);
  }

  let resolvedBaseId;
  let tableIds;
  if (baseId) {
    console.log(`Usando la base existente: ${baseId}`);
    try {
      tableIds = await createTablesInExistingBase(token, baseId);
    } catch (error) {
      console.error('No pude crear las tablas en la base.');
      console.error('Si el error es 403, revisa los scopes schema.bases:read y schema.bases:write,');
      console.error('y que en Access hayas seleccionado el workspace donde estan las bases.');
      console.error('Si el error es 422, el detalle de Airtable aparece en el mensaje de arriba.');
      throw error;
    }
    resolvedBaseId = baseId;
  } else {
    console.log(`Creando base "${BASE_NAME}"...`);
    const base = await createBase(token, workspaceId);
    resolvedBaseId = base.id;
    tableIds = Object.fromEntries(base.tables.map((table) => [table.name, table.id]));
    console.log(`Base creada: ${resolvedBaseId}`);
    for (const [name, id] of Object.entries(tableIds)) console.log(`  ${name}: ${id}`);
  }

  let seedError = null;
  try {
    console.log('Cargando configuracion inicial...');
    await seedConfig(token, resolvedBaseId, tableIds.Config);
    console.log('Cargando producto de ejemplo...');
    await seedProduct(token, resolvedBaseId, tableIds.Productos);
  } catch (error) {
    seedError = error;
    console.error('');
    console.error('No pude cargar la configuracion inicial ni el producto de ejemplo.');
    console.error('Las tablas ya fueron creadas correctamente.');
    console.error('Revisa que el token tenga el scope data.records:write y que tu usuario pueda editar la base.');
    console.error('Detalle: ' + error.message);
    console.error('');
  }

  console.log('Generando blueprints listos para importar...');
  const written = await patchBlueprints(resolvedBaseId, tableIds);
  for (const file of written) console.log(`  ${file}`);

  if (seedError) {
    console.log('');
    console.log('ATENCION: los blueprints se generaron, pero la tabla Config quedo vacia.');
    console.log('Corrige el permiso data.records:write y volve a ejecutar CONFIGURAR.cmd.');
  }

  console.log('');
  console.log('Siguiente paso:');
  console.log('1. Abri Airtable y completa Config (marca, web, email, firma, direccion fisica, propuesta de valor).');
  console.log('2. Edita o borra el producto de ejemplo y carga tu primer producto con foto, precio y descripcion.');
  console.log('3. Importa en Make los archivos LISTO-*.blueprint.json y selecciona la conexion de Airtable en cada modulo.');
  console.log('4. Revisa README.md para el orden de importacion, horarios y prueba controlada.');
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});

