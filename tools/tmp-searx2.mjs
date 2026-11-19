const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const q = "iluminación de diseño Madrid tienda";
for (const host of ["opnxng.com","paulgo.io"]) {
  // JSON?
  try {
    const r = await fetch(`https://${host}/search?q=${encodeURIComponent(q)}&format=json`, { headers:{"user-agent":ua,"accept":"application/json"}, signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    console.log(host, "JSON status", r.status, "len", t.length, t.slice(0,100).replace(/\n/g," "));
    if (r.ok && t.trim().startsWith("{")) {
      const j = JSON.parse(t);
      console.log("  results:", (j.results||[]).length);
      for (const x of (j.results||[]).slice(0,10)) console.log("   *", x.title, "|", x.url, "|", (x.content||"").slice(0,120));
    }
  } catch(e){ console.log(host, "JSON ERR", e.message); }
}
