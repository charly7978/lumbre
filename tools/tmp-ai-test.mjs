import fs from "node:fs";
import { STEPS } from "../lib/prompts.mjs";
import { resolveAIConfig, chat } from "../lib/ai.mjs";
const settings = JSON.parse(fs.readFileSync("data/settings.json","utf8"));
const missions = JSON.parse(fs.readFileSync("data/missions.json","utf8"));
const products = JSON.parse(fs.readFileSync("data/products.json","utf8"));
const m = missions.find(x=>x.id==="mis_9a29d34e94c8");
const product = products.find(p=>p.id===m.productId) || products[0];
const cfg = resolveAIConfig(settings);
const def = STEPS.redteam;
const ctx = { mission: m, product, brand: settings.brand, settings, artifacts: m.artifacts, learnings: [], search: { results: [], pages: [] } };
const prompt = def.prompt(ctx);
console.log("prompt chars:", prompt.length, "maxTokens setting:", cfg.maxTokens);
const t0 = Date.now();
try {
  const result = await chat(cfg, { system: "Sos Abogado del Diablo. Devolvés JSON válido.", prompt, json: true, temperature: 0.55, maxTokens: 3200 });
  console.log("OK", Date.now()-t0, "ms", "usage:", result.usage, "model:", result.model, "text chars:", result.text.length);
  console.log("finish:", result.finishReason, "text tail:", result.text.slice(-160));
} catch(e) {
  console.log("ERR", Date.now()-t0, "ms", e.message);
}
