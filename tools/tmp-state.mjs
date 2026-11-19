import fs from "node:fs";
const t = JSON.parse(fs.readFileSync("data/threads.json","utf8"));
console.log("threads:", t.length, "demo:", t.filter(x=>x.demo).length);
for (const x of t.slice(0,6)) console.log({id:x.id, demo:x.demo, company:x.contact?.company, email:x.contact?.email, stage:x.stage, drafts:(x.drafts||[]).map(d=>d.status), missionId:x.missionId});
const m = JSON.parse(fs.readFileSync("data/meta.json","utf8")); console.log("meta:", m);
const s = JSON.parse(fs.readFileSync("data/suppressions.json","utf8")); console.log("suppressions:", s);
const p = JSON.parse(fs.readFileSync("data/products.json","utf8")); console.log("products:", p.map(x=>({id:x.id,name:x.name,price:x.price,cost:x.cost,status:x.status,demo:x.demo})));
