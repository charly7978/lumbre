const q = `
[out:json][timeout:25];
area["name"="Madrid"]["boundary"="administrative"]->.a;
(
  nwr["shop"~"lighting|lamp|interior_decoration|furniture|gift|art|houseware"]["name"](area.a);
);
out center tags 40;
`;
const endpoints = [
 "https://overpass-api.de/api/interpreter",
 "https://overpass.kumi.systems/api/interpreter",
 "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
for (const ep of endpoints) {
  try {
    const t0=Date.now();
    const r = await fetch(ep, { method:"POST", headers:{"user-agent":"Lumbre/1.0 (local sales research)","content-type":"application/x-www-form-urlencoded"}, body:"data="+encodeURIComponent(q), signal: AbortSignal.timeout(40000)});
    const txt = await r.text();
    let j=null; try{ j=JSON.parse(txt);}catch{}
    console.log(ep, r.status, txt.length, (Date.now()-t0)+"ms", j? "elements:"+j.elements.length : txt.slice(0,120));
    if (j?.elements) {
      for (const e of j.elements.slice(0,12)) {
        const tags=e.tags||{};
        console.log("  -", tags.name, "|", tags.shop, "|", tags.website||tags["contact:website"]||"", "|", tags.email||tags["contact:email"]||"");
      }
    }
  } catch(e) { console.log(ep, "ERR", e.message); }
}
