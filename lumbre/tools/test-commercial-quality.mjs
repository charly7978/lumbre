import assert from 'node:assert/strict';
import { assessCommercialMessage } from '../lib/commercial-quality.mjs';

const weak = assessCommercialMessage({
  subject: 'Velador impreso en 3D para Kolo',
  body: 'Hola. Soy Carlos de Lucian. Trabajamos BORU en PLA, material eco. No vengo con una propuesta cerrada todavía. ¿Les puedo mandar la ficha con fotos y medidas para que la evalúen?',
  product: { name: 'BORU' }, buyer: { nombre: 'Kolo' },
});
assert.equal(weak.reviewRequired, true);
assert.ok(weak.reasons.some((reason) => reason.code === 'no-offer'), 'Debe reconocer falta de propuesta');
assert.ok(weak.reasons.some((reason) => reason.code === 'environmental-claim'), 'Debe reconocer afirmación ambiental sin respaldo');

const strong = assessCommercialMessage({
  subject: 'Kolo | Ficha técnica BORU para evaluar',
  body: 'Hola, equipo de Kolo. Soy Carlos de Lucian y fabricamos BORU. Podés revisar fotos y especificaciones en https://example.org/boru. La pieza mide 20 cm de alto. ¿Quién coordina la incorporación de productos nuevos para la tienda?',
  product: { name: 'BORU' }, buyer: { nombre: 'Kolo' },
});
assert.equal(strong.reviewRequired, false, JSON.stringify(strong));
assert.equal(assessCommercialMessage({ subject: '', body: 'Hola' }).reviewRequired, true);
console.log('OK: el correo débil de BORU requiere revisión; oferta concreta supera el control.');
