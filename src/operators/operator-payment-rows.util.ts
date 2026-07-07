import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import type { OperatorPayDueVariant } from './operator-list-enrichment.util';
import {
  normalizeOperatorPaymentSchedule,
  resolveOperatorPayAlertDueYmd,
  resolveTripPayRowDueYmd,
  tripCompletionAnchorYmd,
  type OperatorPaymentSchedule,
} from './operator-payment-schedule.util';

export const OPERATOR_PAYMENT_RECENT_DAYS = 30;

export type OperatorPaymentRowStatus = 'paid' | 'pending' | 'due' | 'overdue';

export interface OperatorPaymentRow {
  tripId: number;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  quotaAmount: number;
  balance: number;
  paidAmount: number;
  status: OperatorPaymentRowStatus;
  badgeVariant: OperatorPayDueVariant;
  statusHint: string;
  expenseId: number | null;
  paidAtYmd: string | null;
  canConfirm: boolean;
  completionYmd: string | null;
}

export interface OperatorPaymentRowSections {
  pendingPaymentRows: OperatorPaymentRow[];
  recentPaymentRows: OperatorPaymentRow[];
}

type TripLike = Pick<
  Trip,
  | 'id'
  | 'maneuverCode'
  | 'status'
  | 'operatorQuota'
  | 'returnAt'
  | 'arrivedAt'
  | 'plannedCompletionAt'
  | 'completedAt'
>;

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

function parseMoney(raw?: string | null): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function dateLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return ymd;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function expenseIncurredYmd(expense: Expense): string | null {
  const raw = expense.incurredAt;
  if (!raw) {
    return null;
  }
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : localYmd(d);
}

function isActiveExpense(expense: Expense): boolean {
  return expense.discardedAt == null;
}

function isOperatorPayExpenseKind(kind: string): boolean {
  return kind === 'operator_payment' || kind === 'operator_commission';
}

function operatorPaidOnTrip(tripId: number, expenses: readonly Expense[]): number {
  let sum = 0;
  for (const e of expenses) {
    if (!isActiveExpense(e)) {
      continue;
    }
    if (!isOperatorPayExpenseKind(e.kind)) {
      continue;
    }
    if (e.tripId !== tripId) {
      continue;
    }
    sum += parseMoney(e.amount);
  }
  return sum;
}

function primaryOperatorPaymentExpense(
  tripId: number,
  expenses: readonly Expense[],
): Expense | null {
  const matches = expenses.filter(
    (e) =>
      isActiveExpense(e) &&
      e.tripId === tripId &&
      isOperatorPayExpenseKind(e.kind) &&
      parseMoney(e.amount) > 0,
  );
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => {
    const aYmd = expenseIncurredYmd(a) ?? '';
    const bYmd = expenseIncurredYmd(b) ?? '';
    return bYmd.localeCompare(aYmd);
  });
  return matches[0] ?? null;
}

function dueBadgeVariant(dueYmd: string, asOfYmd: string): OperatorPayDueVariant {
  if (dueYmd < asOfYmd) {
    return 'danger';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'warning';
  }
  return 'success';
}

function paymentStatusHint(
  status: OperatorPaymentRowStatus,
  dueYmd: string,
  asOfYmd: string,
): string {
  if (status === 'paid') {
    return 'Pagado';
  }
  if (dueYmd < asOfYmd) {
    return 'Vencido';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'Vence pronto';
  }
  return 'Programado';
}

function resolvePaymentStatus(
  balance: number,
  dueYmd: string,
  asOfYmd: string,
): OperatorPaymentRowStatus {
  if (balance <= 0) {
    return 'paid';
  }
  if (dueYmd < asOfYmd) {
    return 'overdue';
  }
  if (dueYmd === asOfYmd) {
    return 'due';
  }
  return 'pending';
}

function isCompletionWithinRecentDays(
  completionYmd: string | null,
  asOfYmd: string,
  dayCount: number,
): boolean {
  if (!completionYmd) {
    return false;
  }
  const fromYmd = addDaysYmd(asOfYmd, -(dayCount - 1));
  return completionYmd >= fromYmd && completionYmd <= asOfYmd;
}

function sortPendingRows(rows: OperatorPaymentRow[]): OperatorPaymentRow[] {
  return [...rows].sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') {
      return -1;
    }
    if (b.status === 'overdue' && a.status !== 'overdue') {
      return 1;
    }
    if (a.dueYmd !== b.dueYmd) {
      return a.dueYmd.localeCompare(b.dueYmd);
    }
    return a.maneuverCode.localeCompare(b.maneuverCode);
  });
}

function sortRecentRows(rows: OperatorPaymentRow[]): OperatorPaymentRow[] {
  return [...rows].sort((a, b) => {
    const aKey = a.paidAtYmd ?? a.completionYmd ?? a.dueYmd;
    const bKey = b.paidAtYmd ?? b.completionYmd ?? b.dueYmd;
    return bKey.localeCompare(aKey);
  });
}

function buildPaymentRow(
  trip: TripLike,
  quota: number,
  paid: number,
  balance: number,
  completionYmd: string | null,
  schedule: OperatorPaymentSchedule,
  asOfYmd: string,
  batchDueYmd: string | null,
  expenses: readonly Expense[],
): OperatorPaymentRow {
  const dueYmd = resolveTripPayRowDueYmd(
    schedule,
    asOfYmd,
    completionYmd,
    batchDueYmd,
  );
  const status = resolvePaymentStatus(balance, dueYmd, asOfYmd);
  const paymentExpense = primaryOperatorPaymentExpense(trip.id, expenses);
  const paidAtYmd = paymentExpense ? expenseIncurredYmd(paymentExpense) : null;

  return {
    tripId: trip.id,
    maneuverCode: trip.maneuverCode,
    dueYmd,
    dueLabel: dateLabel(dueYmd),
    quotaAmount: quota,
    balance,
    paidAmount: paid,
    status,
    badgeVariant:
      status === 'paid' ? 'success' : dueBadgeVariant(dueYmd, asOfYmd),
    statusHint: paymentStatusHint(status, dueYmd, asOfYmd),
    expenseId: paymentExpense?.id ?? null,
    paidAtYmd,
    canConfirm: balance > 0,
    completionYmd,
  };
}

export function buildOperatorPaymentRows(
  trips: readonly TripLike[],
  expenses: readonly Expense[],
  paymentScheduleRaw: string | null | undefined,
  asOf: Date = new Date(),
): OperatorPaymentRowSections {
  const asOfYmd = localYmd(asOf);
  const schedule = normalizeOperatorPaymentSchedule(paymentScheduleRaw);

  const unpaidCompletionYmds: string[] = [];
  const candidates: Array<{
    trip: TripLike;
    quota: number;
    paid: number;
    balance: number;
    completionYmd: string | null;
  }> = [];

  for (const trip of trips) {
    if (trip.status !== 'completed') {
      continue;
    }
    const quota = parseMoney(trip.operatorQuota);
    if (quota <= 0) {
      continue;
    }
    const paid = operatorPaidOnTrip(trip.id, expenses);
    const balance = Math.max(0, quota - paid);
    const completionYmd = tripCompletionAnchorYmd(trip);
    if (balance > 0 && completionYmd) {
      unpaidCompletionYmds.push(completionYmd);
    }
    candidates.push({ trip, quota, paid, balance, completionYmd });
  }

  const batchDueYmd =
    unpaidCompletionYmds.length > 0
      ? resolveOperatorPayAlertDueYmd(schedule, asOfYmd, unpaidCompletionYmds)
      : null;

  const pendingPaymentRows: OperatorPaymentRow[] = [];
  const recentPaymentRows: OperatorPaymentRow[] = [];

  for (const { trip, quota, paid, balance, completionYmd } of candidates) {
    const row = buildPaymentRow(
      trip,
      quota,
      paid,
      balance,
      completionYmd,
      schedule,
      asOfYmd,
      batchDueYmd,
      expenses,
    );

    if (balance > 0) {
      pendingPaymentRows.push(row);
      continue;
    }

    if (
      isCompletionWithinRecentDays(
        completionYmd,
        asOfYmd,
        OPERATOR_PAYMENT_RECENT_DAYS,
      )
    ) {
      recentPaymentRows.push(row);
    }
  }

  return {
    pendingPaymentRows: sortPendingRows(pendingPaymentRows),
    recentPaymentRows: sortRecentRows(recentPaymentRows),
  };
}

export function summarizeOperatorPaymentRows(
  sections: OperatorPaymentRowSections,
  asOfYmd: string,
): {
  owedTripCount: number;
  owedAmount: number;
  nextPayDueYmd: string | null;
  nextPayDueLabel: string;
  nextPayDueBadgeVariant: OperatorPayDueVariant | 'neutral';
} {
  let owedTripCount = 0;
  let owedAmount = 0;
  let nextPayDueYmd: string | null = null;

  for (const row of sections.pendingPaymentRows) {
    if (row.balance <= 0) {
      continue;
    }
    owedTripCount += 1;
    owedAmount += row.balance;
    if (!nextPayDueYmd || row.dueYmd < nextPayDueYmd) {
      nextPayDueYmd = row.dueYmd;
    }
  }

  const nextPayDueBadgeVariant = nextPayDueYmd
    ? dueBadgeVariant(nextPayDueYmd, asOfYmd)
    : 'neutral';

  return {
    owedTripCount,
    owedAmount,
    nextPayDueYmd,
    nextPayDueLabel: nextPayDueYmd ? dateLabel(nextPayDueYmd) : '—',
    nextPayDueBadgeVariant,
  };
}
