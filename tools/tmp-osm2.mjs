const cities = [
  ["Madrid", 40.4168, -3.7038, 12000],
  ["Barcelona", 41.3874, 2.1686, 10000],
  ["Ciudad de Mexico", 19.4326, -99.1332, 15000],
  ["New York", 40.7128, -74.0060, 12000],
];
const ep = "https://maps.mail.ru/osm/tools/overpass/api/interpreter";
for (const [city, lat, lon, radius] of cities) {
  const q = `[out:json][timeout:45];
(
  nwr["shop"~"lighting|lamps|interior_decoration|furniture|gift|art|houseware"]["name"](around:${radius},${lat},${lon});
);
out center tags 100;`;
  const t0=Date.now();
  try {
    const r = await fetch(ep, { method:"POST", headers:{"user-agent":"Lumbre/1.0 (local sales research)","content-type":"application/x-www-form-urlencoded"}, body:"data="+encodeURIComponent(q), signal: AbortSignal.timeout(70000)});
    const j = await r.json();
    const els = j.elements||[];
    const withWeb = els.filter(e=>e.tags?.website || e.tags?.["contact:website"]);
    const withEmail = els.filter(e=>e.tags?.email || e.tags?.["contact:email"]);
    console.log(`== ${city} status ${r.status} elements ${els.length} withWeb ${withWeb.length} withEmail ${withEmail.length} ms ${Date.now()-t0}`);
    for (const e of withWeb.slice(0,8)) {
      const tg=e.tags;
      console.log("  -", tg.name, "|", tg.shop, "|", tg.website||tg["contact:website"], "|", tg.email||tg["contact:email"]||"");
    }
  } catch(e) { console.log(city, "ERR", e.message, Date.now()-t0); }
  await new Promise(r=>setTimeout(r, 2000));
}
