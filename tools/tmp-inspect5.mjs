import fs from "node:fs";
const missions = JSON.parse(fs.readFileSync("data/missions.json","utf8"));
for (const m of missions) {
  const p = m.artifacts?.prospecting;
  const buyers = p?.compradores || [];
  console.log("---", m.id, "demo:", m.demo, "status:", m.status, "name:", m.name);
  console.log("  buyers:", buyers.length, "segments:", (p?.segmentos||[]).length, "faltantes:", JSON.stringify(p?.faltantes||[]).slice(0,300));
  for (const b of buyers.slice(0,14)) console.log("   *", JSON.stringify({nombre:b.nombre, web:b.web, email:b.email, estado:b.email_estado, prioridad:b.prioridad, fuente:(b.fuente||"").slice(0,90)}));
  console.log("  threads:", (m.stats?.createdThreads??"?"), "search results:", (m.artifacts?.research?.fuentes_consultadas||[]).length, "fuentes:", (m.artifacts?.research?.fuentes||[]).length);
}
