import fs from "node:fs";
import { searchWebDetailed, clearSearchCache } from "../lib/search.mjs";
const settings = JSON.parse(fs.readFileSync("data/settings.json","utf8"));
clearSearchCache();
for (const q of ["tiendas de lámparas de diseño Madrid", "iluminación de diseño Barcelona", "concept store diseño Ciudad de México"]) {
  const t0=Date.now();
  const d = await searchWebDetailed(settings, q, { count: 6 });
  console.log("=== ", q, "|", Date.now()-t0+"ms", "| engine:", d.engine, "| results:", d.results.length);
  console.log("   errors:", JSON.stringify(d.errors.slice(0,4)));
  for (const r of d.results.slice(0,5)) console.log("   -", r.title.slice(0,60), "|", r.url);
  await new Promise(r=>setTimeout(r, 1500));
}
