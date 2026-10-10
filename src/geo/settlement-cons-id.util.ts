import { createHash } from 'crypto';

/** Mismo límite que `client_delivery.settlement_cons_id` y centros operativos. */
export const SETTLEMENT_CONS_ID_MAX_LENGTH = 32;

/** IDs SEPOMex (`id_asenta_cpcons`) caben; slugs largos (Postali) se acortan de forma estable. */
export function normalizeSettlementConsId(
  raw: string | undefined | null,
  cp = '',
): string | undefined {
  const t = (raw ?? '').trim();
  if (!t) {
    return undefined;
  }
  if (t.length <= SETTLEMENT_CONS_ID_MAX_LENGTH) {
    return t;
  }
  const digest = createHash('sha256').update(t).digest('hex').slice(0, 10);
  const cpDigits = cp.replace(/\D/g, '').slice(0, 5);
  const candidate = cpDigits ? `${cpDigits}-${digest}` : digest;
  return candidate.slice(0, SETTLEMENT_CONS_ID_MAX_LENGTH);
}
