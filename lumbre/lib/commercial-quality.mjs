/* Auditor determinista: un mensaje débil se revisa, no se envía automáticamente.
   No acredita consentimiento, entregabilidad ni precisión factual. */
function norm(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function assessCommercialMessage({ subject = '', body = '', product = {}, buyer = {} } = {}) {
  const source = norm(body);
  const subj = norm(subject);
  let score = 100;
  const reasons = [];
  const add = (code, text, deduction) => { reasons.push({ code, text }); score -= deduction; };
  if (!source || source.length < 45) add('empty', 'El mensaje no contiene una propuesta evaluable.', 75);
  if (!subj || subj.length < 8) add('subject', 'El asunto no describe una propuesta concreta.', 15);
  const permission = /(?:puedo|podria|podemos|te|les|le)\s+(?:mandar|enviar|pasar|compartir)|(?:would you like|may i|can i|could i)\s+(?:send|share)/.test(source)
    && /(?:ficha|catalogo|foto|spec|sheet|portfolio|catalog|price|precio)/.test(source);
  const assessable = /https?:\/\/|(?:adjunt[ao]s?|attached|anexo)|(?:medidas?|dimensiones|\b\d+(?:[.,]\d+)?\s?(?:cm|mm)\b)|(?:\b(?:usd|ars|eur)\b|\$\s?\d)|(?:precio mayorista|wholesale terms|trade pricing)/.test(source);
  if (permission && !assessable) add('permission-first', 'Solo pide permiso para mostrar la pieza: incluí ficha o información comercial evaluable.', 42);
  if (/(?:no (?:tengo|traigo|vengo con|hay) (?:una )?propuesta|sin propuesta cerrada|not (?:a|an) (?:specific|complete) offer)/.test(source)) {
    add('no-offer', 'El texto admite que no existe una propuesta concreta.', 38);
  }
  if (/\b(?:ecologic[ao]|eco|eco-?friendly|sustainable|sostenible|biodegradable|100% reciclable|carbon neutral)\b/.test(source)) {
    add('environmental-claim', 'Afirmación ambiental que requiere pruebas; PLA vegetal no la demuestra.', 35);
  }
  if (/(?:ultimas? unidades?|solo por hoy|garantizamos ventas|last chance|guaranteed sales)/.test(source)) {
    add('unverified-pressure', 'Urgencia o promesa que requiere pruebas.', 40);
  }
  const name = norm(product?.name);
  if (name && name.length >= 4 && !source.includes(name)) add('missing-product', 'El mensaje no identifica la lámpara.', 20);
  const company = norm(buyer?.nombre || buyer?.company);
  if (company && company.length > 3 && !(`${subj} ${source}`).includes(company)) add('missing-buyer', 'No identifica al comprador concreto.', 14);
  return {
    score: Math.max(0, score),
    reviewRequired: reasons.some((r) => ['empty', 'permission-first', 'no-offer', 'environmental-claim', 'unverified-pressure', 'missing-product'].includes(r.code)) || score < 70,
    reasons,
  };
}
