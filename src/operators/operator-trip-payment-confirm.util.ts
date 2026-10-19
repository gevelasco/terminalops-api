import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';

export type TripPaymentConfirmTrip = Pick<Trip, 'id' | 'status' | 'operatorQuota'>;

type LedgerExpense = Pick<
  Expense,
  'tripId' | 'kind' | 'amount' | 'paidAt' | 'discardedAt'
>;

function parseMoney(raw?: string | number | null): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function isOperatorPayExpenseKind(kind: string): boolean {
  return kind === 'operator_payment' || kind === 'operator_commission';
}

export type OperatorTripPaymentLedger = {
  quota: number;
  paid: number;
  balance: number;
  unpaidPendingCount: number;
};

/** Misma base que POST confirm-payment (cuota vs pagado en ledger). */
export function summarizeOperatorTripPaymentLedger(
  trip: TripPaymentConfirmTrip | undefined,
  expenses: readonly LedgerExpense[],
  tripId: number,
): OperatorTripPaymentLedger {
  const quota = trip ? parseMoney(trip.operatorQuota) : 0;
  let paid = 0;
  let unpaidPendingCount = 0;
  for (const expense of expenses) {
    if (expense.tripId !== tripId || expense.discardedAt != null) {
      continue;
    }
    if (!isOperatorPayExpenseKind(expense.kind)) {
      continue;
    }
    const amount = parseMoney(expense.amount);
    if (amount <= 0) {
      continue;
    }
    if (expense.paidAt != null) {
      paid += amount;
    } else {
      unpaidPendingCount += 1;
    }
  }
  const balance = Math.max(0, quota - paid);
  return { quota, paid, balance, unpaidPendingCount };
}

export function canConfirmOperatorTripPayment(
  trip: TripPaymentConfirmTrip | undefined,
  ledger: OperatorTripPaymentLedger,
): boolean {
  if (!trip || trip.status !== 'completed') {
    return false;
  }
  if (ledger.quota <= 0) {
    return false;
  }
  return ledger.balance > 0 || ledger.unpaidPendingCount > 0;
}
