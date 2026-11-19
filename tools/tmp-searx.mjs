const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const q = "iluminación de diseño Madrid tienda";
const hosts = ["searx.be","searx.tiekoetter.com","search.inetol.net","opnxng.com","priv.au","baresearch.org","search.rhscz.eu","searxng.site","search.hbubli.cc","paulgo.io","searx.namejeff.xyz","searx.work","search.sapti.me","searx.oloke.xyz","search.bus-hit.me","searx.dresden.network","searx.perennialte.ch","search.im-in.space","searx.tiekoetter.com","searxng.world"];
const results = [];
await Promise.all(hosts.map(async (host) => {
  if (results.some(r=>r.host===host)) return;
  const url = `https://${host}/search?q=${encodeURIComponent(q)}`;
  const t0=Date.now();
  try {
    const r = await fetch(url, { headers:{"user-agent":ua,"accept":"text/html","accept-language":"es-ES,es;q=0.9"}, redirect:"follow", signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    const articles = (t.match(/<article[\s\S]*?<\/article>/gi)||[]);
    const links = [...t.matchAll(/<h3[^>]*>\s*<a[^>]+href="([^"]+)"/gi)].map(m=>m[1]);
    results.push({host, status:r.status, bytes:t.length, articles:articles.length, links:links.length, sample:links.slice(0,3), challenge:/challenge|captcha|cloudflare|anubis/i.test(t), ms:Date.now()-t0});
  } catch(e) {
    results.push({host, error:e.message, ms:Date.now()-t0});
  }
}));
results.sort((a,b)=>(b.links||0)-(a.links||0));
for (const r of results) console.log(JSON.stringify(r));
