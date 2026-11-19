const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n));
async function rss(q) {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url, { headers: { "user-agent": ua }, signal: AbortSignal.timeout(25000) });
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>m[1]);
    console.log(`--- ${q} (${items.length})`);
    for (const it of items.slice(0,6)) {
      const pick = tag => { const m = it.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`,"i")); return m?decode(m[1]).trim():""; };
      console.log("  -", pick("title").slice(0,70), "|", pick("link"));
    }
  } catch(e){ console.log(q, "ERR", e.message); }
}
for (const q of [
  "lámparas de diseño Madrid tienda",
  "Igan iluminación Madrid",
  "iluminación de diseño Barcelona tienda",
  "designer lighting showroom New York",
  "tienda de lámparas de autor Ciudad de México",
  "concept store diseño Madrid",
  "estudio de interiorismo Madrid iluminación",
]) await rss(q);
