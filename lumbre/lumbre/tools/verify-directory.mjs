import { SEED_BUYERS } from '../lib/directory.mjs';
import { verifyWebsite } from '../lib/hunter.mjs';

/* Re-verifica los sitios del directorio semilla con fetch real.
   Uso: npm run verify:directory
   No modifica directory.mjs: imprime un reporte para revisión humana. */
async function main() {
  let ok = 0;
  let fail = 0;
  for (const buyer of SEED_BUYERS) {
    const result = await verifyWebsite(buyer.web, buyer.nombre);
    const status = result.ok ? 'OK' : 'FAIL';
    if (result.ok) ok += 1; else fail += 1;
    console.log(`${status} ${buyer.nombre} -> ${buyer.web} :: ${result.status} ${result.reason || ''}`);
  }
  console.log(`\n${ok} verificados, ${fail} fallidos de ${SEED_BUYERS.length}.`);
  process.exitCode = fail ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});