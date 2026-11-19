const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));
async function rss(label, q, extra="") {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}&count=10${extra}`;
  const r = await fetch(url, { headers: { "user-agent": ua, "accept-language":"es-ES,es;q=0.9,en;q=0.8" }, signal: AbortSignal.timeout(25000) });
  const xml = await r.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
  console.log("=== "+label+" items:"+items.length+" bytes:"+xml.length);
  for (const it of items.slice(0,6)) {
    const pick = tag => { const m = it.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,"i")); return m?decode(m[1]).trim():""; };
    console.log(" -", pick("title"), "|", pick("link"));
  }
}
await rss("plain","tiendas de iluminación de diseño Madrid");
await rss("mkt","tiendas de iluminación de diseño Madrid","&mkt=es-ES&setlang=es");
await rss("cc","design lighting stores Madrid Spain","&cc=ES&setlang=es&mkt=es-ES");
await rss("site-es","iluminación de diseño tienda Madrid","&mkt=es-ES&cc=ES");
