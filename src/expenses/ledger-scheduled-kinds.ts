/** Kinds that the ledger stores as scheduled payables (reads never invent these). */
export const LEDGER_SCHEDULED_KINDS = [
  'insurance',
  'gps',
  'verification',
  'tenure_payment',
  'operator_payment',
  'operator_commission',
] as const;

export type LedgerScheduledKind = (typeof LEDGER_SCHEDULED_KINDS)[number];

export const LEDGER_SCHEDULED_KIND_SET = new Set<string>(LEDGER_SCHEDULED_KINDS);
