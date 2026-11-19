import { searchWeb, searchMany } from "../lib/search.mjs";
import fs from "node:fs";
const settings = JSON.parse(fs.readFileSync("data/settings.json","utf8"));
try {
  const r = await searchWeb(settings, "tiendas de iluminación de diseño España", { count: 8 });
  console.log("searchWeb results:", r.length);
  console.log(JSON.stringify(r,null,2).slice(0,2000));
} catch(e) { console.log("searchWeb ERROR:", e.message); }
const many = await searchMany(settings, ["tiendas de iluminación de diseño España","design lighting showroom España"], { perQuery: 5 });
console.log("searchMany:", JSON.stringify({results:many.results.length,pages:many.pages.length,errors:many.errors},null,2));
