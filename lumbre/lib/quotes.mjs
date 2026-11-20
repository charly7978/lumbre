import { asNumber, asString } from './util.mjs';

/* ─────────────────────────────────────────────────────────────
   Cotizaciones: convierten una conversación en un pedido concreto.
   El texto se arma determinista (sin IA) para que precio, cantidad,
   plazo y link de pago no puedan inventarse ni desviarse.
   Soporta UNA o VARIAS lámparas en la misma cotización.
   ───────────────────────────────────────────────────────────── */

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function quoteTotals({ quantity, unitPrice, shipping = 0, discount = 0, taxRate = 0 } = {}) {
  const qty = Math.max(1, Math.min(100000, Math.floor(asNumber(quantity, 1))));
  const unit = Math.max(0, asNumber(unitPrice, 0));
  const ship = Math.max(0, asNumber(shipping, 0));
  const subtotal = roundMoney(qty * unit);
  const discountAmount = roundMoney(Math.min(subtotal, Math.max(0, asNumber(discount, 0))));
  const rate = Math.max(0, Math.min(100, asNumber(taxRate, 0)));
  const taxable = roundMoney(subtotal - discountAmount + ship);
  const taxAmount = roundMoney(taxable * rate / 100);
  return {
    quantity: qty,
    unitPrice: roundMoney(unit),
    subtotal,
    discount: discountAmount,
    shipping: roundMoney(ship),
    taxRate: rate,
    taxAmount,
    total: roundMoney(taxable + taxAmount),
  };
}

/* Totales para una cotización con VARIAS líneas de producto.
   Cada línea: { quantity, unitPrice, discount }. El envío y los
   impuestos globales se aplican sobre el subtotal de todas las líneas. */
export function quoteTotalsMulti({ items = [], shipping = 0, taxRate = 0 } = {}) {
  const lines = (Array.isArray(items) ? items : []).map((item) => {
    const qty = Math.max(1, Math.min(100000, Math.floor(asNumber(item.quantity, 1))));
    const unit = Math.max(0, asNumber(item.unitPrice, 0));
    const gross = roundMoney(qty * unit);
    const discount = roundMoney(Math.min(gross, Math.max(0, asNumber(item.discount, 0))));
    return { ...item, quantity: qty, unitPrice: unit, gross, discount, lineTotal: roundMoney(gross - discount) };
  });
  const subtotal = roundMoney(lines.reduce((acc, l) => acc + l.lineTotal, 0));
  const totalDiscount = roundMoney(lines.reduce((acc, l) => acc + l.discount, 0));
  const ship = Math.max(0, asNumber(shipping, 0));
  const rate = Math.max(0, Math.min(100, asNumber(taxRate, 0)));
  const taxable = roundMoney(subtotal + ship);
  const taxAmount = roundMoney(taxable * rate / 100);
  return {
    items: lines,
    quantity: lines.reduce((acc, l) => acc + l.quantity, 0),
    subtotal,
    discount: totalDiscount,
    shipping: roundMoney(ship),
    taxRate: rate,
    taxAmount,
    total: roundMoney(taxable + taxAmount),
  };
}

export function quoteNumber(date = new Date(), sequence = 1) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `COT-${stamp}-${String(Math.max(1, sequence)).padStart(3, '0')}`;
}

export function quoteLanguage(thread) {
  const country = String(thread?.contact?.country || '').trim().toLowerCase();
  const explicit = String(thread?.language || '').toLowerCase();
  if (explicit === 'en' || explicit === 'es') return explicit;
  if (/(estados unidos|united states|usa|reino unido|united kingdom|uk|canadá|canada|australia|irlanda|ireland)/.test(country)) return 'en';
  const draftLanguage = (thread?.drafts || []).find((draft) => draft.language)?.language;
  return draftLanguage === 'en' ? 'en' : 'es';
}

export function formatMoney(value, currency = 'USD') {
  const amount = roundMoney(value);
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toLocaleString('es-AR')}`;
  }
}

function formatDate(value, language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).format(date);
}

export function validUntilDate(days = 15, from = new Date()) {
  const date = new Date(from.getTime());
  date.setDate(date.getDate() + Math.max(1, Math.min(120, Math.floor(asNumber(days, 15)))));
  return date.toISOString();
}

export function buildQuote({ thread, product, brand, quote }) {
  const language = quote.language || quoteLanguage(thread);
  const currency = quote.currency || product?.currency || brand?.currency || 'USD';
  const hasItems = Array.isArray(quote.items) && quote.items.length > 0;
  const totals = hasItems ? quoteTotalsMulti(quote) : quoteTotals(quote);
  const productName = String(product?.name || quote.productName || 'la pieza').trim();
  const code = String(product?.code || '').trim();
  const unit = formatMoney(totals.unitPrice, currency);
  const subtotal = formatMoney(totals.subtotal, currency);
  const shipping = formatMoney(totals.shipping, currency);
  const discount = formatMoney(totals.discount, currency);
  const tax = formatMoney(totals.taxAmount, currency);
  const total = formatMoney(totals.total, currency);
  const validUntil = formatDate(quote.validUntil, language);
  const leadTime = Math.max(0, Math.floor(asNumber(product?.leadTimeDays, 0)));
  const capacity = Math.max(0, Math.floor(asNumber(product?.capacityPerWeek, 0)));
  const signature = brand?.name
    ? `\n\n${brand.maker ? `${brand.maker} · ` : ''}${brand.name}${brand.website ? `\n${brand.website}` : ''}`
    : '';

  const capacityNote = language === 'en'
    ? (capacity > 0
      ? `\nProduction capacity: ${capacity} units per week.${totals.quantity > capacity ? ` For ${totals.quantity} units we will split the delivery into weekly batches.` : ''}`
      : '')
    : (capacity > 0
      ? `\nCapacidad de producción: ${capacity} unidades por semana.${totals.quantity > capacity ? ` Para ${totals.quantity} unidades, la entrega se reparte en tandas semanales.` : ''}`
      : '');

  const subject = language === 'en'
    ? `Quote ${quote.number} · ${hasItems ? `${totals.items.length} pieces` : productName}`
    : `Cotización ${quote.number} · ${hasItems ? `${totals.items.length} piezas` : productName}`;

  const itemLines = hasItems
    ? totals.items.map((l) => {
        const name = String(l.productName || l.name || 'Pieza').trim();
        const lineCode = String(l.code || '').trim();
        const lineUnit = formatMoney(l.unitPrice, currency);
        const lineTotal = formatMoney(l.lineTotal, currency);
        return `${l.quantity} × ${name}${lineCode ? ` (${lineCode})` : ''} — ${lineUnit} c/u = ${lineTotal}`
          + (l.discount > 0 ? ` [desc. -${formatMoney(l.discount, currency)}]` : '');
      })
    : [`${totals.quantity} × ${productName}${code ? ` (${code})` : ''} — ${unit} c/u = ${subtotal}`];

  const condLines = [
    quote.payTerms ? (language === 'en' ? `Payment terms: ${quote.payTerms}` : `Condiciones de pago: ${quote.payTerms}`) : null,
    quote.volumeNote ? (language === 'en' ? `Volume discount: ${quote.volumeNote}` : `Descuento por volumen: ${quote.volumeNote}`) : null,
    quote.shipNote ? (language === 'en' ? `Shipping details: ${quote.shipNote}` : `Detalle de envío: ${quote.shipNote}`) : null,
    quote.notes || null,
  ].filter(Boolean);
  const lineNotes = hasItems ? totals.items.map((l) => [
    l.color ? (language === 'en' ? `Color/finish: ${l.color}` : `Color/acabado: ${l.color}`) : null,
    l.lineNote || null,
  ].filter(Boolean).map((x) => '  - ' + x).join('\n')) : '';

  const lines = language === 'en'
    ? [
      `Hi${thread?.contact?.name ? ` ${thread.contact.name.split(' ')[0]}` : ''}.`,
      '',
      hasItems
        ? `Thank you for your interest. Here is the formal quote for the ${totals.items.length} pieces below.`
        : `Thank you for your interest in ${productName}. Here is the formal quote.`,
      '',
      ...itemLines,
      hasItems ? `Subtotal: ${subtotal}` : null,
      totals.shipping > 0 ? `Shipping: ${shipping}` : 'Shipping: to be confirmed by destination.',
      totals.discount > 0 ? `Discount: -${discount}` : '',
      totals.taxAmount > 0 ? `Tax (${totals.taxRate}%): ${tax}` : '',
      `Total: ${total}`,
      leadTime > 0 ? `Lead time: ${leadTime} business days after payment confirmation.` : '',
      `Quote valid until: ${validUntil}.`,
      quote.paymentLink
        ? `To confirm the order you can pay here: ${quote.paymentLink}`
        : 'To confirm, reply to this email and I will send you the payment link.',
      capacityNote,
      lineNotes ? `\n${lineNotes}` : '',
      ...condLines,
      '',
      'If the quantity or destination changes, tell me and I will update the quote.',
      signature,
    ]
    : [
      `Hola${thread?.contact?.name ? ` ${thread.contact.name.split(' ')[0]}` : ''}.`,
      '',
      hasItems
        ? `Gracias por tu interés. Te paso la cotización formal de las ${totals.items.length} piezas:`
        : `Gracias por el interés en ${productName}. Te paso la cotización formal.`,
      '',
      ...itemLines,
      hasItems ? `Subtotal: ${subtotal}` : null,
      totals.shipping > 0 ? `Envío estimado: ${shipping}` : 'Envío: a confirmar según destino.',
      totals.discount > 0 ? `Descuento: -${discount}` : '',
      totals.taxAmount > 0 ? `Impuestos (${totals.taxRate}%): ${tax}` : '',
      `Total: ${total}`,
      leadTime > 0 ? `Plazo de fabricación: ${leadTime} días hábiles desde la confirmación del pago.` : '',
      `Validez de la cotización: hasta el ${validUntil}.`,
      quote.paymentLink
        ? `Para confirmar el pedido podés pagar acá: ${quote.paymentLink}`
        : 'Para confirmar, respondé este correo y te paso el link de pago.',
      capacityNote,
      lineNotes ? `\n${lineNotes}` : '',
      ...condLines,
      '',
      'Si cambia la cantidad o el destino, decime y actualizo la cotización.',
      signature,
    ];

  return {
    subject,
    text: lines.filter((line) => line !== null && line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    language,
    totals,
    validUntil,
  };
}
