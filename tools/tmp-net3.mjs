const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const q = "tiendas de iluminación de diseño Madrid";
const tests = [
  ["google-basic", `https://www.google.com/search?q=${encodeURIComponent(q)}&gbv=1&num=10&hl=es`],
  ["google-num", `https://www.google.com/search?q=${encodeURIComponent(q)}&num=10&hl=es`],
  ["yahoo", `https://search.yahoo.com/search?p=${encodeURIComponent(q)}&n=10`],
  ["ask", `https://www.ask.com/web?q=${encodeURIComponent(q)}`],
  ["qwant-api", `https://api.qwant.com/v3/search/web?q=${encodeURIComponent(q)}&count=10&locale=es_ES&offset=0&device=desktop&safesearch=0&lp=1`],
  ["bing-cookie", `https://www.bing.com/search?q=${encodeURIComponent(q)}&form=QBLH&qs=n`],
];
for (const [name,url] of tests) {
  try {
    const r = await fetch(url, { headers: { "user-agent": ua, "accept":"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8", "accept-language":"es-ES,es;q=0.9,en;q=0.8", "cookie":"SRCHHPGUSR=SRCHLANG=es&BRW=W&BRH=S&CW=1280&CH=720&DPR=1&UTC=-180&DM=0&HV=1794960000&WTS=63800000000&PV=10.0.0; _EDGE_S=mkt=es-es" }, redirect:"follow", signal: AbortSignal.timeout(25000) });
    const t = await r.text();
    let extra = "";
    if (name.startsWith("google")) extra = " urls=" + (t.match(/\/url\?q=/g)||[]).length + " cap=" + /captcha|unusual traffic/i.test(t);
    if (name==="yahoo") extra = " results=" + (t.match(/class="[^"]*algo[^"]*"/g)||[]).length;
    if (name==="ask") extra = " results=" + (t.match(/class="[^"]*result[^"]*"/g)||[]).length;
    if (name==="qwant-api") extra = " json=" + t.slice(0,200);
    if (name==="bing-cookie") extra = " b_algo=" + (t.match(/class="b_algo"/g)||[]).length;
    console.log(name, r.status, t.length, extra);
    if (name.startsWith("google")) {
      const links = [...t.matchAll(/<a href="\/url\?q=([^&"]+)/g)].map(m=>decodeURIComponent(m[1])).slice(0,10);
      console.log("  links:", links.join(" | "));
    }
    if (name==="yahoo") console.log("  head:", t.replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,300));
    if (name==="qwant-api") console.log("  body:", t.slice(0,300));
  } catch(e) { console.log(name, "ERR", e.message); }
}
