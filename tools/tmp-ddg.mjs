const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const q = "iluminación de diseño Madrid tienda";
// 1) Inspect DDG challenge
const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { headers:{ "user-agent": ua, "accept":"text/html","accept-language":"es-ES,es;q=0.9" }, signal: AbortSignal.timeout(20000) });
const t = await r.text();
console.log("DDG status", r.status, "len", t.length);
const body = t.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
console.log("DDG text:", body.slice(0,600));
console.log("forms:", (t.match(/<form[\s\S]*?<\/form>/gi)||[]).map(f=>f.replace(/\s+/g," ").slice(0,300)));
// 2) POST variant
for (const [label, url, opts] of [
  ["POST-html", "https://html.duckduckgo.com/html/", { method:"POST", body:new URLSearchParams({q, b:"", kl:"wt-wt"}), headers:{"content-type":"application/x-www-form-urlencoded","user-agent":ua,"accept":"text/html","referer":"https://html.duckduckgo.com/","accept-language":"es-ES,es;q=0.9"} }],
  ["POST-lite", "https://lite.duckduckgo.com/lite/", { method:"POST", body:new URLSearchParams({q, kl:"wt-wt"}), headers:{"content-type":"application/x-www-form-urlencoded","user-agent":ua,"accept":"text/html","referer":"https://lite.duckduckgo.com/","accept-language":"es-ES,es;q=0.9"} }],
  ["duck-html", "https://duckduckgo.com/html/?q="+encodeURIComponent(q), { headers:{"user-agent":ua,"accept":"text/html","accept-language":"es-ES,es;q=0.9"} }],
  ["mobile-html", "https://html.duckduckgo.com/html/?q="+encodeURIComponent(q), { headers:{"user-agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1","accept":"text/html","accept-language":"es-ES,es;q=0.9"} }],
]) {
  try {
    const rr = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
    const tt = await rr.text();
    const res = (tt.match(/class="result__a"/g)||[]).length;
    const challenge = /anomaly|bots use DuckDuckGo|challenge/i.test(tt);
    console.log(label, rr.status, tt.length, "result__a:", res, "challenge:", challenge, tt.replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,120));
  } catch(e){ console.log(label, "ERR", e.message); }
}
