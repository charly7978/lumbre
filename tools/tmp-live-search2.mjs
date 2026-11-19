import fs from "node:fs";
import { searchWebDetailed } from "../lib/search.mjs";
const settings = JSON.parse(fs.readFileSync("data/settings.json","utf8"));
for (const q of ["tiendas de iluminación y lámparas Madrid", "lámparas de diseño Barcelona", "showroom iluminación Barcelona", "tiendas de diseño e interiorismo Madrid", "design lighting stores Ciudad de México"]) {
  const t0=Date.now();
  const d = await searchWebDetailed(settings, q, { count: 7 });
  console.log("=== ", q, "|", Date.now()-t0+"ms", "| engine:", d.engine, "| results:", d.results.length);
  for (const r of d.results.slice(0,6)) console.log("   -", r.title.slice(0,70), "|", r.url);
  if (!d.results.length) console.log("   errors:", JSON.stringify(d.errors.slice(0,3)));
  await new Promise(r=>setTimeout(r, 1200));
}
