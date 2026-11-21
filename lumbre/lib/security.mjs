import crypto from 'node:crypto';

/** Verify Meta's SHA-256 webhook signature over the exact request bytes. */
export function verifyMetaSignature(rawBody, header, appSecret) {
  if (!Buffer.isBuffer(rawBody) || !appSecret) return false;
  const value = String(header || '');
  if (!/^sha256=[a-f0-9]{64}$/i.test(value)) return false;
  const provided = Buffer.from(value.slice(7), 'hex');
  const expected = crypto.createHmac('sha256', String(appSecret)).update(rawBody).digest();
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

/** A public business email is not evidence of permission to use Resend. */
export function hasDocumentedOptIn(contact) {
  const permission = contact?.permission;
  return permission?.status === 'opted_in'
    && typeof permission.evidence === 'string'
    && permission.evidence.trim().length >= 10
    && typeof permission.capturedAt === 'string'
    && Number.isFinite(Date.parse(permission.capturedAt));
}

/** Stable across HTTP retries and restarts for the same approved draft. */
export function resendIdempotencyKey(threadId, draftId) {
  if (!threadId || !draftId) throw new Error('Falta identificar la conversación o el borrador.');
  return 'lumbre-' + crypto.createHash('sha256')
    .update(JSON.stringify([String(threadId), String(draftId)]))
    .digest('hex');
}
