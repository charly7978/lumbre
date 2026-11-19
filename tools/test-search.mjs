import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// La caché de búsqueda se persiste en disco junto a los datos; los tests
// nunca deben tocar el directorio real del dueño.
process.env.LUMBRE_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lumbre-cache-test-'));
import {
  clearSearchCache, filterRelevantResults, isDuckDuckGoChallenge, parseSearxngResults,
  searchProviderInfo, searchWeb, searchWebDetailed,
} from '../lib/search.mjs';
import { extractEmails } from '../lib/util.mjs';
import { isRateLimitError } from '../lib/ai.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const searxFixture = fs.readFileSync(path.join(here, 'fixtures', 'searxng-results.html'), 'utf8');
const ddgChallenge = fs.readFileSync(path.join(here, 'fixtures', 'ddg-challenge.html'), 'utf8');

let passed = 0;
process.on('exit', () => { try { fs.rmSync(process.env.LUMBRE_DATA_DIR, { recursive: true, force: true }); } catch { /* noop */ } });
function ok(condition, label) {
  if (!condition) {
    console.error(`FALLO: ${label}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  passed += 1;
  console.log(`OK ${label}`);
}

/* Parser de resultados de SearXNG. */
const results = parseSearxngResults(searxFixture, 8);
ok(results.length >= 2, 'parsea los resultados de SearXNG');
ok(results[0].url.startsWith('http'), 'el primero tiene URL absoluta');
ok(/avanluce/i.test(`${results[0].title} ${results[0].url}`), 'lee el título y la URL reales', JSON.stringify(results[0]));
ok(results.some((item) => item.snippet.length > 40), 'lee el resumen (snippet)');
ok(results.every((item) => item.provider === 'searxng' && item.engine), 'marca proveedor y motor');
ok(new Set(results.map((item) => item.url)).size === results.length, 'deduplica por URL');
ok(parseSearxngResults('<html>sin resultados</html>').length === 0, 'HTML sin resultados devuelve lista vacía');
ok(parseSearxngResults('<article class="result"><h3><a href="/relativo">x</a></h3></article>').length === 0, 'descarta enlaces relativos');

/* Detección de bloqueo de DuckDuckGo: nunca confundirlo con "0 resultados". */
ok(isDuckDuckGoChallenge(ddgChallenge), 'detecta el desafío anti-bots de DuckDuckGo');
ok(!isDuckDuckGoChallenge(searxFixture), 'no confunde una página normal con un desafío');

/* Filtro de relevancia: la basura de los motores públicos no llega al modelo. */
const relevance = filterRelevantResults('tiendas de lámparas de diseño Madrid', [
  { title: 'Ideas Luz · Tienda de lámparas de diseño en Madrid', url: 'https://www.ideasluz.com/', snippet: '' },
  { title: 'EGLO Colombia: Tienda de iluminación y lámparas', url: 'https://www.eglo.com/co/', snippet: '' },
  { title: '马来西亚的ZON香烟 - 百度知道', url: 'https://zhidao.baidu.com/question/1.html', snippet: '' },
  { title: 'Tienda de productos para animales', url: 'https://tiendas.tiendanimal.es/', snippet: '' },
], { strict: true });
ok(relevance.length === 1 && /ideasluz/i.test(relevance[0].url), 'descarta resultados que no comparten la ciudad ni la consulta');
const broadQuery = filterRelevantResults('designer lighting trends 2026 handmade small series', [
  { title: 'Designer lighting trends 2026: handmade and small series', url: 'https://ejemplo.com/a', snippet: '' },
  { title: 'Noticias de otra cosa', url: 'https://ejemplo.com/b', snippet: '' },
]);
ok(broadQuery.length === 1, 'acepta el resultado que comparte los términos de la consulta');

/* Extracción de emails: los de ejemplo no entran nunca al flujo. */
const emails = extractEmails('Escribí a compras@tienda-real.com o a info@example.com; también VENTAS@Tienda-Real.com. Imagen logo@2x.png');
ok(emails.includes('compras@tienda-real.com'), 'conserva el email real');
ok(emails.includes('ventas@tienda-real.com'), 'normaliza a minúsculas y deduplica');
ok(!emails.some((email) => email.includes('example.com')), 'descarta emails de ejemplo');
ok(!emails.some((email) => email.endsWith('.png')), 'descarta nombres de archivo que parecen emails');

/* Estado del proveedor. */
const ready = searchProviderInfo({ search: { provider: 'duckduckgo' } });
ok(ready.ready === true && /SearXNG/i.test(ready.label), 'la búsqueda sin clave se anuncia como SearXNG');
const noKey = searchProviderInfo({ search: { provider: 'tavily', apiKey: '' } });
ok(noKey.ready === false, 'Tavily sin clave no se declara lista');
const off = searchProviderInfo({ search: { provider: 'none' } });
ok(off.ready === true, 'la búsqueda apagada es una decisión válida');

/* Proveedores sin red: devuelven error explícito, no una lista vacía muda. */
clearSearchCache();
const noneDetail = await searchWebDetailed({ search: { provider: 'none' } }, 'tiendas de diseño Madrid');
ok(noneDetail.results.length === 0 && noneDetail.errors.length === 0, 'proveedor none no inventa resultados ni errores');

const tavilyDetail = await searchWebDetailed({ search: { provider: 'tavily', apiKey: '' } }, 'tiendas de diseño Madrid');
ok(tavilyDetail.errors.some((e) => /Falta la clave/.test(e)), 'proveedor sin clave explica el error');

let result = null;
try {
  result = await searchWeb({ search: { provider: 'tavily', apiKey: '' } }, 'tiendas de diseÃ±o Madrid');
} catch { result = null; }
ok(Array.isArray(result) || result === null, 'searchWeb con fallback devuelve lista o lanza');

/* 413 de Groq por tokens por minuto: es cuota temporal, no un pedido
   imposible. Si se tratara como error fatal, el paso se cae y la misión
   muere (pasó en "Mercado y competencia" y en "Plan final"). */
ok(isRateLimitError(new Error('413 Request too large for model `qwen/qwen3.8-27b` in organization `x` service tier `on_demand` on input tokens per minute')), 'detecta el 413 por tokens por minuto como límite temporal');
ok(isRateLimitError(new Error('429 rate limit exceeded')), 'detecta el 429 como límite temporal');
ok(!isRateLimitError(new Error('401 unauthorized')), 'una clave rechazada no es un límite temporal');
ok(!isRateLimitError(new Error('413 Payload Too Large')), 'un cuerpo demasiado grande no se reintenta como cuota');

console.log(`\n${passed} comprobaciones de búsqueda OK`);
