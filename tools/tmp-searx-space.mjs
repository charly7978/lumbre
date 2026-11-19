const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const r = await fetch("https://searx.space/data/instances.json", { headers:{"user-agent":ua}, signal:AbortSignal.timeout(30000) });
console.log("instances.json status", r.status);
const j = await r.json();
const instances = Object.entries(j.instances || {});
console.log("total:", instances.length);
const candidates = instances.filter(([url, info]) => {
  if (!/^https:\/\//.test(url)) return false;
  if (info.network_type && info.network_type !== "normal") return false;
  const timing = info.timing || {};
  const http = info.http || {};
  return http.status_code === 200;
}).map(([url, info]) => ({ url: url.replace(/\/$/,""), version: info.version||"", timing: info.timing?.search?.all?.median ?? 9999, network: info.network_type||"" }))
  .sort((a,b)=>a.timing-b.timing)
  .slice(0, 25);
console.log("candidates:", candidates.length);
for (const c of candidates.slice(0,12)) console.log(" -", c.url, c.version, c.timing+"ms");
const q = "tiendas de iluminación de diseño Madrid";
const results = [];
await Promise.all(candidates.map(async (c) => {
  try {
    const t0=Date.now();
    const rr = await fetch(`${c.url}/search?q=${encodeURIComponent(q)}`, { headers:{"user-agent":ua,"accept":"text/html","accept-language":"es-ES,es;q=0.9"}, signal: AbortSignal.timeout(12000) });
    const t = await rr.text();
    const n = (t.match(/<article[^>]*class="[^"]*result/g)||[]).length;
    results.push({ url:c.url, status:rr.status, n, ms:Date.now()-t0 });
  } catch(e){ results.push({ url:c.url, error:e.message }); }
}));
results.sort((a,b)=>(b.n||0)-(a.n||0));
console.log("\n=== query results ===");
for (const x of results) console.log(JSON.stringify(x));
