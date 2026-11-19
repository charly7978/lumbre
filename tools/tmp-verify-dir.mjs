import { inspectSite, verifyWebsite } from "../lib/hunter.mjs";
const candidates = [
  ["Ideas Luz","https://www.ideasluz.com","Madrid","España"],
  ["Hogarlux","https://hogarlux.com","Madrid","España"],
  ["Lámparas Oliva","https://www.lamparasoliva.com","Madrid","España"],
  ["Años Luz","https://www.anosluz.com","Madrid","España"],
  ["Avanluce","https://www.avanluce.com","Barcelona","España"],
  ["Insolit BCN","https://www.insolitbcn.com","Barcelona","España"],
  ["Lámparas Barcelona","https://lamparasbarcelona.com","Barcelona","España"],
  ["La Maison Barcelona","https://lamaisonbarcelona.com","Barcelona","España"],
  ["Mar de Cava","https://mardecava.com","Barcelona","España"],
  ["Pilight Shop","https://www.pilight.es","Barcelona","España"],
  ["MINIM","https://www.minim.es","Barcelona","España"],
  ["Barcelona LED","https://www.barcelonaled.com","Barcelona","España"],
  ["Casa Blanco","https://casablanco.com.ar","Buenos Aires","Argentina"],
  ["Iluminación Agüero","https://iluminacionaguero.com","Buenos Aires","Argentina"],
  ["GA Iluminación","https://gailuminacion.com","Buenos Aires","Argentina"],
  ["Línea Iluminación","https://www.lineailuminacion.com.ar","Buenos Aires","Argentina"],
  ["Solar Concept Gallery","https://solarconceptgallery.com","Buenos Aires","Argentina"],
  ["Scultura Luminosa","https://sculturaluminosa.com","Ciudad de México","México"],
  ["Scultura Luminosa MX","https://sculturaluminosa.mx","Ciudad de México","México"],
  ["Diez Company","https://diezcompany.com","Ciudad de México","México"],
  ["Diez Company MX","https://diezcompany.mx","Ciudad de México","México"],
  ["Interlight","https://www.interlight.cl","Santiago","Chile"],
  ["Luminaire","https://www.luminaire.com","Miami","Estados Unidos"],
  ["Lighting by Gregory","https://www.lightingbygregory.com","New York","Estados Unidos"],
  ["YLighting","https://www.ylighting.com","New York","Estados Unidos"],
  ["Lumens","https://www.lumens.com","New York","Estados Unidos"],
];
for (const [nombre, web, ciudad, pais] of candidates) {
  const v = await verifyWebsite(web, nombre);
  let emails = [];
  if (v.ok) { try { const s = await inspectSite(web, {maxPages:2}); emails = s.emails.map(e=>e.email); } catch {} }
  console.log(`${v.ok ? "OK  " : "NO  "} | ${nombre.padEnd(22)} | ${ciudad.padEnd(16)} | ${web} | ${v.status} | ${(v.title||"").slice(0,50)} | emails: ${emails.join(", ")}`);
}
