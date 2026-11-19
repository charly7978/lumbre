const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
function strip(s){ return String(s||"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g," ").replace(/\s+/g," ").trim(); }
function parseBing(html){
  const out=[];
  const re = /<li class="b_algo"[\s\S]*?(?=<li class="b_algo"|<li class="b_ans"|<\/ol>)/gi;
  const blocks = html.match(re)||[];
  for(const b of blocks){
    const a = b.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if(!a) continue;
    const snippet = b.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || b.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || b.match(/class="b_caption"[^>]*>([\s\S]*?)<\/li>/i);
    out.push({title:strip(a[2]), url:a[1], snippet:snippet?strip(snippet[1]).slice(0,220):""});
  }
  return out;
}
async function bing(q, extra=""){
  const url=`https://www.bing.com/search?q=${encodeURIComponent(q)}&count=10${extra}`;
  const r=await fetch(url,{headers:{"user-agent":ua,"accept":"text/html,application/xhtml+xml","accept-language":"es-ES,es;q=0.9,en;q=0.8"},signal:AbortSignal.timeout(25000)});
  const t=await r.text();
  const results=parseBing(t);
  console.log(`=== ${q} [${extra}] status ${r.status} bytes ${t.length} parsed ${results.length}`);
  results.slice(0,8).forEach((x,i)=>console.log(`  ${i+1}. ${x.title} | ${x.url} | ${x.snippet.slice(0,110)}`));
}
await bing("tiendas de iluminación de diseño España");
await bing("design lighting showroom Spain");
await bing("tiendas de iluminación de diseño México", "&cc=MX");
await bing("interior design studios Madrid lighting projects", "&cc=ES");
await bing("concept store design objects Mexico City", "&cc=MX");
