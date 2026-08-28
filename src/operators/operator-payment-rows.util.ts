import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import type { OperatorPayDueVariant } from './operator-list-enrichment.util';

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

function parseMoney(raw?: string | number | null): number {
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

function expenseDueYmd(expense: Expense): string | null {
  if (!expense.incurredAt) {
    return null;
  }
  return formatOperationalIncurredDateYmd(expense.incurredAt);
}

function expensePaidYmd(expense: Expense): string | null {
  if (!expense.paidAt) {
    return null;
  }
  return formatOperationalIncurredDateYmd(expense.paidAt);
}

function isActiveExpense(expense: Expense): boolean {
  return expense.discardedAt == null;
}

function isOperatorPayExpenseKind(kind: string): boolean {
  return kind === 'operator_payment' || kind === 'operator_commission';
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
  paid: boolean,
  dueYmd: string,
  asOfYmd: string,
): OperatorPaymentRowStatus {
  if (paid) {
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

function isDateWithinRecentDays(
  ymd: string | null,
  asOfYmd: string,
  dayCount: number,
): boolean {
  if (!ymd) {
    return false;
  }
  const fromYmd = addDaysYmd(asOfYmd, -(dayCount - 1));
  return ymd >= fromYmd && ymd <= asOfYmd;
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
    const aKey = a.paidAtYmd ?? a.dueYmd;
    const bKey = b.paidAtYmd ?? b.dueYmd;
    return bKey.localeCompare(aKey);
  });
}

/**
 * Filas de pago a operador: solo gastos del ledger.
 * El trip se usa para etiqueta de maniobra y si ya se puede confirmar.
 */
export function buildOperatorPaymentRows(
  trips: readonly TripLike[],
  expenses: readonly Expense[],
  asOf: Date = new Date(),
  periodFrom?: string,
  periodTo?: string,
): OperatorPaymentRowSections {
  const asOfYmd = localYmd(asOf);
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
  const pendingPaymentRows: OperatorPaymentRow[] = [];
  const recentPaymentRows: OperatorPaymentRow[] = [];

  for (const expense of expenses) {
    if (!isActiveExpense(expense) || !isOperatorPayExpenseKind(expense.kind)) {
      continue;
    }
    const amount = parseMoney(expense.amount);
    if (amount <= 0) {
      continue;
    }
    const dueYmd = expenseDueYmd(expense);
    if (!dueYmd) {
      continue;
    }
    const trip = expense.tripId != null ? tripsById.get(expense.tripId) : undefined;
    const paid = expense.paidAt != null;
    const status = resolvePaymentStatus(paid, dueYmd, asOfYmd);
    const paidAtYmd = expensePaidYmd(expense);
    const completionYmd = trip?.completedAt
      ? formatOperationalIncurredDateYmd(trip.completedAt)
      : null;
    const row: OperatorPaymentRow = {
      tripId: expense.tripId ?? 0,
      maneuverCode: trip?.maneuverCode?.trim() || (expense.tripId != null ? `#${expense.tripId}` : '—'),
      dueYmd,
      dueLabel: dateLabel(dueYmd),
      quotaAmount: amount,
      balance: paid ? 0 : amount,
      paidAmount: paid ? amount : 0,
      status,
      badgeVariant: paid ? 'success' : dueBadgeVariant(dueYmd, asOfYmd),
      statusHint: paymentStatusHint(status, dueYmd, asOfYmd),
      expenseId: expense.id,
      paidAtYmd,
      canConfirm: !paid && trip?.status === 'completed',
      completionYmd,
    };

    if (!paid) {
      pendingPaymentRows.push(row);
      continue;
    }

    const inScope =
      periodFrom && periodTo
        ? dueYmd >= periodFrom && dueYmd <= periodTo
        : isDateWithinRecentDays(paidAtYmd ?? dueYmd, asOfYmd, OPERATOR_PAYMENT_RECENT_DAYS);
    if (inScope) {
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
