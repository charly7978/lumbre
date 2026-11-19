const urls = [
  ["ddg-html","https://html.duckduckgo.com/html/?q=tiendas+de+iluminacion+de+diseno+Espa%C3%B1a&kl=wt-wt"],
  ["ddg-lite","https://lite.duckduckgo.com/lite/?q=tiendas+de+iluminacion+de+diseno+Espa%C3%B1a"],
  ["bing","https://www.bing.com/search?q=tiendas+de+iluminacion+de+diseno+Espa%C3%B1a"],
  ["mojeek","https://www.mojeek.com/search?q=tiendas+de+iluminacion+de+diseno+Espa%C3%B1a"],
  ["startpage","https://www.startpage.com/sp/search?query=tiendas+de+iluminacion+de+diseno"],
  ["searx-be","https://searx.be/search?q=tiendas+de+iluminacion+de+diseno&format=json"],
  ["brave-html","https://search.brave.com/search?q=tiendas+de+iluminacion+de+diseno"],
  ["ecosia","https://www.ecosia.org/search?q=tiendas+de+iluminacion+de+diseno"],
  ["yandex","https://yandex.com/search/?text=tiendas+de+iluminacion+de+diseno"],
  ["google","https://www.google.com/search?q=tiendas+de+iluminacion+de+diseno&hl=es"],
];
for (const [name,url] of urls) {
  const t0=Date.now();
  try {
    const r = await fetch(url, { redirect:"follow", headers:{ "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36", "accept":"text/html,application/xhtml+xml", "accept-language":"es-ES,es;q=0.9,en;q=0.8" }, signal: AbortSignal.timeout(20000)});
    const text = await r.text();
    const marker = /captcha|unusual traffic|challenge|verify|captcha-delivery|robot/i.test(text) ? "BLOCK?" : "";
    console.log(name, r.status, "bytes:", text.length, marker, "ct:", r.headers.get("content-type"), (Date.now()-t0)+"ms");
    console.log("   head:", text.replace(/\s+/g," ").slice(0,180));
  } catch(e) { console.log(name, "ERR", e.message, (Date.now()-t0)+"ms"); }
}
