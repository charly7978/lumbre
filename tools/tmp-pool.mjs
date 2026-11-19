const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const hosts = ["paulgo.io","opnxng.com","searx.dresden.network","searx.tiekoetter.com","search.inetol.net","priv.au"];
const qs = [
 "tiendas de lámparas de diseño Madrid",
 "showroom iluminación de diseño Barcelona",
 "concept store diseño Ciudad de México",
 "designer lighting showroom New York",
 "estudio de interiorismo Madrid iluminación",
];
for (const host of hosts) {
  let ok=0, err=0, res=0;
  for (const q of qs) {
    try {
      const r = await fetch(`https://${host}/search?q=${encodeURIComponent(q)}`, { headers:{"user-agent":ua,"accept":"text/html","accept-language":"es-ES,es;q=0.9"}, signal: AbortSignal.timeout(15000) });
      const t = await r.text();
      const n = (t.match(/<article[^>]*class="[^"]*result/g)||[]).length;
      console.log(host, r.status, "articles:", n, "|", q.slice(0,40));
      if (r.status===200 && n>0) { ok++; res+=n; } else err++;
    } catch(e){ console.log(host, "ERR", e.message); err++; }
    await new Promise(r=>setTimeout(r, 1200));
  }
  console.log("==>", host, "ok:", ok, "err:", err, "results:", res);
  await new Promise(r=>setTimeout(r, 1500));
}
