import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import {
  normalizeOperatorPaymentSchedule,
  resolveOperatorPayAlertDueYmd,
  tripCompletionAnchorYmd,
  type OperatorPaymentSchedule,
} from './operator-payment-schedule.util';

export type OperatorPayDueVariant = 'success' | 'warning' | 'danger';

export interface OperatorLastManeuverSnapshot {
  tripId: number;
  maneuverCode: string;
  origin: string;
  destination: string;
  status: string;
  occurredOn?: string;
}

export interface OperatorNextPayDueSnapshot {
  dueOn: string;
  variant: OperatorPayDueVariant;
  /** Saldo pendiente total (maniobras completadas con cuota por pagar). */
  owedAmount: number;
}

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

function tripActivityDate(trip: Trip): Date | null {
  const anchor =
    trip.completedAt ?? trip.returnAt ?? trip.arrivedAt ?? trip.plannedDepartureAt;
  if (!anchor) {
    return null;
  }
  const d = anchor instanceof Date ? anchor : new Date(anchor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildOperatorLastManeuverSnapshot(
  trip: Trip,
): OperatorLastManeuverSnapshot {
  const activity = tripActivityDate(trip);
  return {
    tripId: trip.id,
    maneuverCode: trip.maneuverCode,
    origin: trip.origin,
    destination: trip.destination,
    status: trip.status,
    occurredOn: activity ? localYmd(activity) : undefined,
  };
}

function dueBadgeVariant(
  dueYmd: string,
  asOfYmd: string,
): OperatorPayDueVariant {
  if (dueYmd < asOfYmd) {
    return 'danger';
  }
  if (dueYmd <= addDaysYmd(asOfYmd, 7)) {
    return 'warning';
  }
  return 'success';
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

interface OwedOperatorTrips {
  owedAmount: number;
  completionYmds: string[];
}

/** Próximo vencimiento y saldo pendiente al operador según método de cobro. */
export function buildNextPayDueByOperatorId(
  trips: readonly Trip[],
  expenses: readonly Expense[],
  paymentScheduleByOperatorId: ReadonlyMap<
    number,
    string | OperatorPaymentSchedule | null | undefined
  > = new Map(),
  asOf: Date = new Date(),
): Map<number, OperatorNextPayDueSnapshot> {
  const asOfYmd = localYmd(asOf);
  const owedByOperator = new Map<number, OwedOperatorTrips>();

  for (const trip of trips) {
    if (trip.status != null && trip.status !== 'completed') {
      continue;
    }
    const operatorId = trip.operatorId;
    if (operatorId == null) {
      continue;
    }
    const quota = parseMoney(trip.operatorQuota);
    if (quota <= 0) {
      continue;
    }
    const paid = operatorPaidOnTrip(trip.id, expenses);
    const balance = Math.max(0, quota - paid);
    if (balance <= 0) {
      continue;
    }

    const entry = owedByOperator.get(operatorId) ?? {
      owedAmount: 0,
      completionYmds: [],
    };
    entry.owedAmount += balance;
    const completionYmd = tripCompletionAnchorYmd(trip);
    if (completionYmd) {
      entry.completionYmds.push(completionYmd);
    }
    owedByOperator.set(operatorId, entry);
  }

  const byOperator = new Map<number, OperatorNextPayDueSnapshot>();
  for (const [operatorId, { owedAmount, completionYmds }] of owedByOperator) {
    const schedule = normalizeOperatorPaymentSchedule(
      paymentScheduleByOperatorId.get(operatorId),
    );
    const dueOn = resolveOperatorPayAlertDueYmd(
      schedule,
      asOfYmd,
      completionYmds,
    );
    if (!dueOn) {
      continue;
    }
    byOperator.set(operatorId, {
      dueOn,
      variant: dueBadgeVariant(dueOn, asOfYmd),
      owedAmount,
    });
  }

  return byOperator;
}
