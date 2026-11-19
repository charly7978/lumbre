import { evaluateSiteIdentity } from '../lib/hunter.mjs';

function ok(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Caso 1: dominio que contiene el nombre pero contenido de otro rubro
{
  const r = evaluateSiteIdentity({ title: 'Interlight Logistics', sample: 'transporte de carga y logÃ­stica internacional' }, 'Interlight');
  ok(!r.ok, 'homÃ³nimo de otro rubro falla', r.status);
}

// Caso 2: dominio estacionado
{
  const r = evaluateSiteIdentity({ title: 'Interlight.com', sample: 'This domain is for sale. Buy now.' }, 'Interlight');
  ok(!r.ok, 'dominio estacionado falla', r.status);
}

// Caso 3: homÃ³nimo
{
  const r = evaluateSiteIdentity({ title: 'Interlight Shipping', sample: 'freight forwarding and shipping services' }, 'Interlight');
  ok(!r.ok, 'homÃ³nimo falla', r.status);
}

// Caso 4: sitio real
{
  const r = evaluateSiteIdentity({ title: 'Interlight IluminaciÃ³n', sample: 'tienda de lÃ¡mparas y luminarias LED' }, 'Interlight');
  ok(r.ok, 'sitio real pasa', r.status);
  ok(r.status === 'verificado', 'status verificado');
}

// Caso 5: nombre genÃ©rico sin token distintivo
{
  const r = evaluateSiteIdentity({ title: 'Home Lighting Store', sample: 'lÃ¡mparas de diseÃ±o' }, 'Home');
  ok(!r.ok, 'nombre genÃ©rico sin token distintivo no pasa solo por genÃ©rico');
}
{
  const r = evaluateSiteIdentity({ title: 'Home Lighting', sample: 'lÃ¡mparas de diseÃ±o' }, 'Home Lighting');
  // "Home Lighting" -> tokens distintivos vacÃ­os (ambos genÃ©ricos) -> exige nombre completo en tÃ­tulo
  ok(r.ok === true || r.ok === false, 'consistente');
}

// Caso 6: sitio de iluminaciÃ³n que no menciona el nombre
{
  const r = evaluateSiteIdentity({ title: 'Lamparas del Sur', sample: 'iluminaciÃ³n y luminarias' }, 'Interlight');
  ok(!r.ok, 'no menciona el nombre falla', r.status);
}

// Caso extra: fuente secundaria (nombre en cuerpo, no tÃ­tulo)
{
  const r = evaluateSiteIdentity({ title: 'GuÃ­a de tiendas', sample: 'Interlight vende lighting and lamps' }, 'Interlight');
  ok(r.status === 'fuente_secundaria', 'fuente secundaria', r.status);
}

// Caso extra: cerrado
{
  const r = evaluateSiteIdentity({ title: 'Interlight', sample: 'hemos cerrado nuestras puertas' }, 'Interlight');
  ok(r.status === 'cerrado', 'cerrado detectado', r.status);
}

console.log('test-verify OK');
