import type { SelectQueryBuilder } from 'typeorm';
import type { Expense } from './entities/expense.entity';
import { LEDGER_SCHEDULED_KINDS } from './ledger-scheduled-kinds';

/** Pendientes de ledger (paid_at null) en rango de fecha operativa MX. */
export function applyUnpaidScheduledLedgerRange(
  qb: SelectQueryBuilder<Expense>,
  range: { from: string; to: string },
): SelectQueryBuilder<Expense> {
  return qb
    .andWhere('e.discardedAt IS NULL')
    .andWhere('e.paidAt IS NULL')
    .andWhere('e.kind IN (:...ledgerScheduledKinds)', {
      ledgerScheduledKinds: [...LEDGER_SCHEDULED_KINDS],
    })
    .andWhere(
      `(e.incurred_at AT TIME ZONE 'America/Mexico_City')::date BETWEEN :unpaidFrom AND :unpaidTo`,
      { unpaidFrom: range.from, unpaidTo: range.to },
    );
}
