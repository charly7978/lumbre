import fs from "node:fs";
const missions = JSON.parse(fs.readFileSync("data/missions.json","utf8"));
const list = Array.isArray(missions)?missions:(missions.items||missions.missions||Object.values(missions));
console.log("total missions:", list.length);
for (const m of list) {
  console.log("---");
  console.log({id:m.id, status:m.status, demo:m.demo, product:m.productName||m.product?.name, market:m.market, depth:m.depth, createdAt:m.createdAt, finishedAt:m.finishedAt, warnings:(m.warnings||[]).length, steps:(m.steps||[]).length, threads:(m.threads||[]).length});
  if (m.warnings) console.log("warnings:", JSON.stringify(m.warnings).slice(0,900));
  console.log("keys:", Object.keys(m).join(","));
}
