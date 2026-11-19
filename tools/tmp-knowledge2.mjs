import fs from "node:fs";
import { resolveAIConfig, generateJson } from "../lib/ai.mjs";
import { safeFetchText, htmlToText, normalizeDomain } from "../lib/util.mjs";
const settings = JSON.parse(fs.readFileSync("data/settings.json","utf8"));
const cfg = resolveAIConfig(settings);
const prompt = `Tarea: proponer TIENDAS MULTIMARCA y distribuidores reales (no fabricantes) que compren lámparas de diseño a marcas pequeñas para revender, en Argentina, España y México.
Cada uno debe ser un comercio con local físico que hoy venda lámparas u objetos de diseño de varias marcas.
Solo empresas reales, con su sitio web oficial. Si no estás seguro de la URL, dejá "web" vacío.
Priorizá Buenos Aires, Madrid, Barcelona y Ciudad de México.
Máximo 12.
Devolvé este JSON:
{"compradores":[{"nombre":"","tipo":"tienda|distribuidor|concept store","pais":"","ciudad":"","web":"","por_que":""}]}`;
const t0=Date.now();
const res = await generateJson(cfg, { system:"Sos analista de mercado. Devolvés JSON válido.", prompt, temperature:0.3, maxTokens:3200, expects:"object" });
console.log("AI ms:", Date.now()-t0, "usage:", res.usage);
const buyers = res.data?.compradores || [];
console.log("buyers:", buyers.length);
let verified=0;
for (const b of buyers.slice(0,12)) {
  let status="sin_web";
  if (b.web && /^https?:\/\//.test(b.web)) {
    try {
      const p = await safeFetchText(b.web, { timeoutMs: 12000, maxBytes: 500000 });
      const text = (p.title + " " + htmlToText(p.text)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      const token = String(b.nombre||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/\s+/).filter(t=>t.length>3)[0]||"";
      status = text.includes(token) ? "verificado" : "sin_coincidencia";
    } catch(e) { status="no_responde:"+e.message; }
  }
  if (status==="verificado") verified++;
  console.log("  -", b.nombre, "|", b.ciudad, "|", b.web||"(sin web)", "=>", status);
}
console.log("verified:", verified, "/", buyers.length);
