import fs from "node:fs";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
for (const host of ["paulgo.io","opnxng.com","searx.dresden.network"]) {
  try {
    const r = await fetch(`https://${host}/search?q=${encodeURIComponent("tiendas de iluminacion de diseno Barcelona")}`, { headers:{"user-agent":ua,"accept":"text/html","accept-language":"es-ES,es;q=0.9"}, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log(host, r.status, t.length, "articles:", (t.match(/<article/g)||[]).length);
    if (r.status === 200 && t.includes("<article")) {
      fs.writeFileSync(`tools/fixtures-searx-${host.replace(/\./g,"_")}.html`, t);
      console.log("saved fixture");
      const i = t.indexOf("<article");
      console.log(t.slice(i, i+1200).replace(/\s+/g," "));
      break;
    }
  } catch(e){ console.log(host, "ERR", e.message); }
}
