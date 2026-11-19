const q = "tiendas de iluminación de diseño España";
const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const tests = [
 ["bing-rss", `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}&count=10`, "application/rss+xml,text/xml,*/*"],
 ["bing-html", `https://www.bing.com/search?q=${encodeURIComponent(q)}&count=10`, "text/html"],
 ["google-html", `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=es&num=10`, "text/html"],
 ["mojeek", `https://www.mojeek.com/search?q=${encodeURIComponent(q)}`, "text/html"],
 ["ddg-html", `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, "text/html"],
];
for (const [name,url,accept] of tests) {
  try {
    const r = await fetch(url, { headers: { "user-agent": ua, accept, "accept-language": "es-ES,es;q=0.9,en;q=0.8" }, redirect:"follow", signal: AbortSignal.timeout(25000) });
    const t = await r.text();
    const info = { name, status: r.status, bytes: t.length, ct: r.headers.get("content-type") };
    if (/rss|xml/.test(String(info.ct))) {
      info.items = (t.match(/<item[\s>]/g)||[]).length;
      info.sample = t.replace(/\s+/g," ").slice(0,300);
    } else if (name === "bing-html") {
      info.b_algo = (t.match(/class="b_algo"/g)||[]).length;
      info.b_results = (t.match(/id="b_results"/g)||[]).length;
      info.captcha = /captcha|unusual traffic|verify you are human/i.test(t);
      const idx = t.indexOf("b_algo");
      info.sample = idx>=0 ? t.slice(idx-100, idx+500).replace(/\s+/g," ") : t.replace(/\s+/g," ").slice(0,300);
    } else if (name === "google-html") {
      info.urls = (t.match(/\/url\?q=|href="https?:\/\//g)||[]).length;
      info.captcha = /sorry|unusual traffic|captcha/i.test(t);
      info.sample = t.slice(0,300).replace(/\s+/g," ");
    } else if (name === "mojeek") {
      info.results = (t.match(/class="results-standard"|class="ob"/g)||[]).length;
      info.captcha = /captcha|blocked/i.test(t);
      info.sample = t.replace(/\s+/g," ").slice(0,500);
    } else {
      info.challenge = /anomaly|challenge|detected unusual/i.test(t);
      info.sample = t.replace(/\s+/g," ").slice(0,300);
    }
    console.log(JSON.stringify(info,null,1));
  } catch(e) { console.log(name, "ERR", e.message); }
}
