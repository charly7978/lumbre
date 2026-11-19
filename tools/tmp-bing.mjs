const q = "tiendas de iluminación de diseño Madrid";
const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}&count=10`;
const r = await fetch(url, { headers: { "user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" }, signal: AbortSignal.timeout(25000) });
const xml = await r.text();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
console.log("items:", items.length);
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));
for (const it of items.slice(0,10)) {
  const pick = tag => { const m = it.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,"i")); return m?decode(m[1]).trim():""; };
  console.log("-", pick("title"));
  console.log("  ", pick("link"));
  console.log("  ", pick("description").replace(/\s+/g," ").slice(0,160));
}
