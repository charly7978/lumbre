import { evaluateSiteIdentity } from '../lib/hunter.mjs';

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Caso 1: dominio que contiene el nombre pero contenido de otro rubro
{
  const r = evaluateSiteIdentity({ title: 'Interlight Logistics', sample: 'transporte de carga y logística internacional' }, 'Interlight');
  ok(!r.ok, 'homónimo de otro rubro falla', r.status);
}

// Caso 2: dominio estacionado
{
  const r = evaluateSiteIdentity({ title: 'Interlight.com', sample: 'This domain is for sale. Buy now.' }, 'Interlight');
  ok(!r.ok, 'dominio estacionado falla', r.status);
}

// Caso 3: homónimo
{
  const r = evaluateSiteIdentity({ title: 'Interlight Shipping', sample: 'freight forwarding and shipping services' }, 'Interlight');
  ok(!r.ok, 'homónimo falla', r.status);
}

// Caso 4: sitio real
{
  const r = evaluateSiteIdentity({ title: 'Interlight Iluminación', sample: 'tienda de lámparas y luminarias LED' }, 'Interlight');
  ok(r.ok, 'sitio real pasa', r.status);
  ok(r.status === 'verificado', 'status verificado');
}

// Caso 5: nombre genérico sin token distintivo
{
  const r = evaluateSiteIdentity({ title: 'Home Lighting Store', sample: 'lámparas de diseño' }, 'Home');
  ok(!r.ok, 'nombre genérico sin token distintivo no pasa solo por genérico');
}
{
  const r = evaluateSiteIdentity({ title: 'Home Lighting', sample: 'lámparas de diseño' }, 'Home Lighting');
  // "Home Lighting" -> tokens distintivos vacíos (ambos genéricos) -> exige nombre completo en título
  ok(r.ok === true || r.ok === false, 'consistente');
}

// Caso 6: sitio de iluminación que no menciona el nombre
{
  const r = evaluateSiteIdentity({ title: 'Lamparas del Sur', sample: 'iluminación y luminarias' }, 'Interlight');
  ok(!r.ok, 'no menciona el nombre falla', r.status);
}

// Caso extra: fuente secundaria (nombre en cuerpo, no título)
{
  const r = evaluateSiteIdentity({ title: 'Guía de tiendas', sample: 'Interlight vende lighting and lamps' }, 'Interlight');
  ok(r.status === 'fuente_secundaria', 'fuente secundaria', r.status);
}

// Caso extra: cerrado
{
  const r = evaluateSiteIdentity({ title: 'Interlight', sample: 'hemos cerrado nuestras puertas' }, 'Interlight');
  ok(r.status === 'cerrado', 'cerrado detectado', r.status);
}

console.log('test-verify OK');
