import assert from 'node:assert/strict';
import { buildCommercialStrategy, readinessForStrategy, researchQueries, validateStrategy } from '../lib/commercial-strategy.mjs';

const product = {
  id: 'p-luz', name: 'BORU', code: 'B001', category: 'Velador',
  price: 210, currency: 'USD', materials: 'PLA', dimensions: '20 x 25 cm',
  photos: [{ file: 'boru.webp' }], publicUrl: 'https://example.org/boru',
  status: 'listo',
};
assert.equal(readinessForStrategy(product).readyToPublish, true);
assert.equal(readinessForStrategy({ ...product, publicUrl: 'file:///secret', photos: [] }).readyToPublish, false);
assert.equal(researchQueries(product, 'Argentina', 'retail').length, 2);

let searches = 0, generates = 0;
const plan = await buildCommercialStrategy({
  product, market: 'Argentina', audience: 'architects',
  brand: { name: 'Lucian', city: 'Caseros' },
}, {
  search: async () => {
    searches++;
    return { results: [{ title: 'Estudio real de prueba', url: 'https://example.org/estudio', snippet: 'Iluminación' }] };
  },
  generate: async ({ prompt }) => {
    generates++;
    assert.match(prompt, /arquitectos e interioristas/);
    assert.match(prompt, /F1/);
    assert.doesNotMatch(prompt, /apiKey|contraseña/);
    return { data: {
      diagnostico: 'Investigar oferta real', propuesta: { titulo: 'Oferta BORU', argumento: 'Probar montaje', sourceIds: ['F1', 'F999'] },
      compradorIdeal: { titulo: 'Estudio', sourceIds: ['F1'] },
      canales: [{ canal: 'tiktok', pieza: 'Reel de fabricación', sourceIds: ['F1', 'F999'] }],
      acciones: [{ accion: 'Mejorar fotos', metrica: 'Consultas', prioridad: 'alta' }],
      emailB2B: { asunto: 'BORU', mensaje: 'Borrador sin envío' },
      reel: { gancho: 'La luz', escenas: ['Plano', 'Detalle'], cta: 'Ver ficha' },
    } };
  },
});
assert.equal(searches, 2);
assert.equal(generates, 1);
assert.equal(plan.fuentes.length, 1);
assert.deepEqual(plan.propuesta.sourceIds, ['F1']);
assert.deepEqual(plan.canales[0].sourceIds, ['F1']);
assert.equal(plan.emailB2B.estado, 'BORRADOR_NO_ENVIADO');
assert.equal(plan.canales[0].estado, 'BORRADOR_NO_PUBLICADO');
assert.equal(plan.estado, 'BORRADOR_PARA_APROBACION');

const withoutEvidence = validateStrategy({ canales: [{ canal: 'telegram', sourceIds: ['F99'] }] }, {
  product: { ...product, photos: [], publicUrl: 'javascript:alert(1)' },
  sources: [], market: 'España', audience: 'retail', queries: [], errors: [],
});
assert.equal(withoutEvidence.canales[0].canal, 'catalogo');
assert.equal(withoutEvidence.canales[0].sourceIds.length, 0);
assert.equal(withoutEvidence.preparacion.readyToPublish, false);
assert.match(withoutEvidence.alertas.join(' '), /No se encontraron fuentes/);
await assert.rejects(() => buildCommercialStrategy({ product, market: 'Argentina', audience: 'unknown' }, {
  search: async () => ({ results: [] }), generate: async () => ({ data: {} }),
}), /segmento/);
console.log('OK: estrategia comercial trazable, fuentes validadas, sin envíos ni publicaciones.');
