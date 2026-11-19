import fs from "node:fs";
const missions = JSON.parse(fs.readFileSync("data/missions.json","utf8"));
const m = missions.find(x=>x.id==="mis_6db79905b862");
console.log("LOG entries:", (m.log||[]).length);
for (const e of (m.log||[])) {
  console.log(JSON.stringify({at:e.at, level:e.level, step:e.step, msg:e.msg || e.message || e.text, meta:e.meta}).slice(0,600));
}
