import fs from "node:fs";
import { resolveAIConfig, generateJson } from "../lib/ai.mjs";
import { safeFetchText, htmlToText, normalizeDomain } from "../lib/util.mjs";
const settings = JSON.parse(fs.readFileSync("data/settings.json","utf8"));
const cfg = resolveAIConfig(settings);
const prompt = `Tarea: proponer tiendas y estudios reales que compren lámparas de diseño para reventa en España y México.
Requisitos:
- Solo nombres de empresas reales que existan hoy, con su sitio web oficial (URL completa). No inventes.
- Priorizá tiendas de iluminación de diseño, concept stores de interiorismo y distribuidores con local físico.
- Incluí ciudad y país.
- Si no estás seguro del sitio web, dejá "web" vacío.
- Máximo 12.
Devolvé este JSON:
{"compradores":[{"nombre":"","tipo":"tienda|distribuidor|concept store|estudio","pais":"","ciudad":"","web":"","por_que":""}]}`;
const t0=Date.now();
const res = await generateJson(cfg, { system:"Sos analista de mercado. Devolvés JSON válido.", prompt, temperature:0.3, maxTokens:3200, expects:"object" });
console.log("AI ms:", Date.now()-t0, "usage:", res.usage, "attempts:", res.attempts);
const buyers = res.data?.compradores || [];
console.log("buyers:", buyers.length);
const checked = [];
for (const b of buyers.slice(0,12)) {
  let status = "sin_web";
  if (b.web && /^https?:\/\//.test(b.web)) {
    try {
      const p = await safeFetchText(b.web, { timeoutMs: 12000, maxBytes: 500000 });
      const text = (p.title + " " + htmlToText(p.text)).toLowerCase();
      const token = String(b.nombre||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").split(/\s+/).filter(t=>t.length>3)[0]||"";
      status = text.includes(token) ? "verificado" : "sin_coincidencia";
      console.log("  -", b.nombre, "|", b.ciudad, "|", b.web, "=>", status, "| title:", p.title.slice(0,70));
    } catch(e) { status = "no_responde:"+e.message; console.log("  -", b.nombre, "|", b.web, "=>", status); }
  } else console.log("  -", b.nombre, "|", b.ciudad, "| web:", JSON.stringify(b.web), "=>", status);
  checked.push({ ...b, status });
}
console.log("verified:", checked.filter(x=>x.status==="verificado").length, "/", checked.length);
