const ua = "Lumbre/1.0 (local sales research; contact: local)";
const queries = [
  ["iluminación Buenos Aires", "ar"],
  ["lámparas Buenos Aires", "ar"],
  ["iluminación Madrid", "es"],
  ["iluminación Ciudad de México", "mx"],
  ["lighting store New York", "us"],
];
for (const [q, cc] of queries) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=30&extratags=1&addressdetails=1&countrycodes=${cc}`;
  try {
    const t0=Date.now();
    const r = await fetch(url, { headers:{"user-agent":ua,"accept":"application/json"}, signal:AbortSignal.timeout(25000) });
    const j = await r.json();
    const list = Array.isArray(j)?j:[];
    const shops = list.filter(x=>x.category==="shop"||x.class==="shop");
    const withWeb = list.filter(x=>x.extratags?.website || x.extratags?.["contact:website"]);
    console.log(`== ${q} status ${r.status} total ${list.length} shops ${shops.length} withWeb ${withWeb.length} ms ${Date.now()-t0}`);
    for (const x of list.slice(0,10)) console.log("  -", x.name, "|", x.category||x.class, x.type||"", "|", x.extratags?.website||x.extratags?.["contact:website"]||"", "|", x.extratags?.email||"");
    await new Promise(r=>setTimeout(r, 1200));
  } catch(e) { console.log(q, "ERR", e.message); }
}
