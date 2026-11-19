const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const q = "Avanluce Barcelona iluminación";
const tests = [
 ["google", `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=es&num=10`],
 ["yandex", `https://yandex.com/search/?text=${encodeURIComponent(q)}`],
 ["aol", `https://search.aol.com/aol/search?q=${encodeURIComponent(q)}`],
 ["marginalia", `https://search.marginalia.nu/search?query=${encodeURIComponent(q)}`],
 ["mwmbl", `https://mwmbl.org/?q=${encodeURIComponent(q)}`],
 ["stract", `https://stract.com/search?q=${encodeURIComponent(q)}`],
 ["yep", `https://yep.com/web?q=${encodeURIComponent(q)}`],
 ["brave", `https://search.brave.com/search?q=${encodeURIComponent(q)}`],
 ["bing", `https://www.bing.com/search?q=${encodeURIComponent(q)}`],
 ["startpage", `https://www.startpage.com/sp/search?query=${encodeURIComponent(q)}`],
 ["mojeek", `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`],
 ["searx-paulgo", `https://paulgo.io/search?q=${encodeURIComponent(q)}`],
];
for (const [name,url] of tests) {
  try {
    const t0=Date.now();
    const r = await fetch(url, { headers:{"user-agent":ua,"accept":"text/html,application/xhtml+xml","accept-language":"es-ES,es;q=0.9,en;q=0.8"}, redirect:"follow", signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    const has = /avanluce/i.test(t);
    const hits = (t.match(/avanluce/gi)||[]).length;
    console.log(name, r.status, "bytes:", t.length, "avanluce:", hits, "ms:", Date.now()-t0);
  } catch(e) { console.log(name, "ERR", e.message); }
}
