/* Diagnóstico comercial: orienta, no promete ventas ni sustituye verificaciones. */
export function productReadiness(product = {}) {
  const checks = [
    { id: 'photo', ok: Array.isArray(product.photos) && product.photos.length > 0, label: 'Agregar foto real del producto', critical: true },
    { id: 'price', ok: Number(product.price) > 0, label: 'Definir precio de venta mayor a cero', critical: true },
    { id: 'cost', ok: Number(product.cost) > 0, label: 'Informar costo de fabricación para calcular margen', critical: false },
    { id: 'description', ok: String(product.description || '').trim().length >= 25, label: 'Escribir una descripción comercial de al menos 25 caracteres', critical: false },
    { id: 'dimensions', ok: Boolean(String(product.dimensions || '').trim()), label: 'Indicar medidas para cotizar embalaje y envío', critical: false },
    { id: 'weight', ok: Number(product.weightGrams) > 0, label: 'Indicar peso para logística', critical: false },
    { id: 'capacity', ok: Number(product.capacityPerWeek) > 0, label: 'Estimar unidades fabricables por semana', critical: false },
    { id: 'leadTime', ok: Number(product.leadTimeDays) > 0, label: 'Definir plazo de fabricación en días', critical: false },
  ];
  const missing = checks.filter((item) => !item.ok);
  return {
    score: Math.round((checks.length - missing.length) / checks.length * 100),
    readyForProspecting: !checks.some((item) => item.critical && !item.ok) && product.status !== 'archivado',
    missing: missing.map(({ id, label, critical }) => ({ id, label, critical })),
    warnings: missing.map((item) => item.label),
  };
}
