import { safeFetchText, htmlToText, extractEmails, normalizeDomain } from "../lib/util.mjs";
const sites = ["https://www.ideasluz.com/","https://www.luzespacio.com/","https://anosluziluminacion.com/es/","https://www.igan-iluminacion.com/es/"];
for (const s of sites) {
  const t0=Date.now();
  try {
    const p = await safeFetchText(s, { timeoutMs: 15000, maxBytes: 600000 });
    const text = htmlToText(p.text);
    console.log(s, "OK", p.status, "title:", p.title.slice(0,80), "chars:", text.length, "ms:", Date.now()-t0);
    console.log("   emails:", extractEmails(p.text + "\n" + text).slice(0,6).join(", "));
    console.log("   sample:", text.replace(/\s+/g," ").slice(0,160));
  } catch(e) { console.log(s, "ERR", e.message); }
}
