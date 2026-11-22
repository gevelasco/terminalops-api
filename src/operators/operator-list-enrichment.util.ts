import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import type { Unit } from 'src/units/entities/unit.entity';
import { buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';
import {
  buildOperatorPaymentRows,
  summarizeOperatorPaymentRows,
} from 'src/operators/operator-payment-rows.util';
import {
  buildTripDestinationCityPostalLabel,
  buildTripOriginCityPostalLabel,
} from 'src/trips/trip-route-label.util';

export type OperatorPayDueVariant = 'success' | 'warning' | 'danger';

export interface OperatorLastManeuverSnapshot {
  tripId: number;
  maneuverCode: string;
  origin: string;
  destination: string;
  status: string;
  occurredOn?: string;
}

/** Maniobra activa (en curso / programada) para cards de operadores. */
export interface OperatorActiveServiceSnapshot {
  tripId: number;
  maneuverCode: string;
  origin: string;
  destination: string;
  unitCode: string;
}

export interface OperatorNextPayDueSnapshot {
  dueOn?: string;
  variant?: OperatorPayDueVariant;
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
  const anchor = trip.returnAt ?? trip.completedAt;
  if (!anchor) {
    return null;
  }
  const d = anchor instanceof Date ? anchor : new Date(anchor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function operationalYmdMx(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function buildOperatorActiveServiceSnapshot(
  trip: Trip,
  unit: Unit | null | undefined,
): OperatorActiveServiceSnapshot {
  const unitCode = unit
    ? buildUnitOperationalId(unit)
    : trip.unitId != null
      ? String(trip.unitId)
      : '—';
  return {
    tripId: trip.id,
    maneuverCode: trip.maneuverCode,
    origin: buildTripOriginCityPostalLabel(trip),
    destination: buildTripDestinationCityPostalLabel(trip),
    unitCode,
  };
}

export function buildOperatorLastManeuverSnapshot(
  trip: Trip,
): OperatorLastManeuverSnapshot {
  const activity = tripActivityDate(trip);
  return {
    tripId: trip.id,
    maneuverCode: trip.maneuverCode,
    origin: buildTripOriginCityPostalLabel(trip),
    destination: buildTripDestinationCityPostalLabel(trip),
    status: trip.status,
    occurredOn: activity ? operationalYmdMx(activity) : undefined,
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

interface OwedOperatorLedger {
  owedAmount: number;
  nextDueYmd: string | null;
}

/** Próximo vencimiento y saldo pendiente: solo filas del ledger sin pagar. */
export function buildNextPayDueByOperatorId(
  trips: readonly Trip[],
  expenses: readonly Expense[],
  asOf: Date = new Date(),
): Map<number, OperatorNextPayDueSnapshot> {
  const asOfYmd = localYmd(asOf);
  const operatorIdByTripId = new Map<number, number>();
  for (const trip of trips) {
    if (trip.operatorId != null) {
      operatorIdByTripId.set(trip.id, trip.operatorId);
    }
  }

  const owedByOperator = new Map<number, OwedOperatorLedger>();
  for (const expense of expenses) {
    if (!isActiveExpense(expense) || !isOperatorPayExpenseKind(expense.kind)) {
      continue;
    }
    if (expense.paidAt != null) {
      continue;
    }
    const amount = parseMoney(expense.amount);
    if (amount <= 0) {
      continue;
    }
    const operatorId =
      expense.relatedOperatorId ??
      (expense.tripId != null ? operatorIdByTripId.get(expense.tripId) : undefined);
    if (operatorId == null) {
      continue;
    }
    const dueYmd = expense.incurredAt
      ? operationalYmdMx(
          expense.incurredAt instanceof Date
            ? expense.incurredAt
            : new Date(expense.incurredAt),
        )
      : null;
    const entry = owedByOperator.get(operatorId) ?? {
      owedAmount: 0,
      nextDueYmd: null,
    };
    entry.owedAmount += amount;
    if (dueYmd && (!entry.nextDueYmd || dueYmd < entry.nextDueYmd)) {
      entry.nextDueYmd = dueYmd;
    }
    owedByOperator.set(operatorId, entry);
  }

  const byOperator = new Map<number, OperatorNextPayDueSnapshot>();
  for (const [operatorId, { owedAmount, nextDueYmd }] of owedByOperator) {
    if (!nextDueYmd) {
      continue;
    }
    byOperator.set(operatorId, {
      dueOn: nextDueYmd,
      variant: dueBadgeVariant(nextDueYmd, asOfYmd),
      owedAmount,
    });
  }

  return byOperator;
}

/**
 * Misma lógica que el resumen del drawer (buildOperatorPaymentRows +
 * summarizeOperatorPaymentRows), agrupado por operador para el listado.
 */
export function buildOperatorListPaymentSnapshots(
  trips: readonly Trip[],
  expenses: readonly Expense[],
  asOf: Date = new Date(),
): Map<number, OperatorNextPayDueSnapshot> {
  const asOfYmd = localYmd(asOf);
  const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
  const tripsByOperator = new Map<number, Trip[]>();
  for (const trip of trips) {
    if (trip.operatorId == null) {
      continue;
    }
    const bucket = tripsByOperator.get(trip.operatorId) ?? [];
    bucket.push(trip);
    tripsByOperator.set(trip.operatorId, bucket);
  }

  const expensesByOperator = new Map<number, Expense[]>();
  for (const expense of expenses) {
    const trip =
      expense.tripId != null ? tripsById.get(expense.tripId) : undefined;
    const operatorId = trip?.operatorId ?? expense.relatedOperatorId;
    if (operatorId == null) {
      continue;
    }
    const bucket = expensesByOperator.get(operatorId) ?? [];
    bucket.push(expense);
    expensesByOperator.set(operatorId, bucket);
  }

  const operatorIds = new Set<number>([
    ...tripsByOperator.keys(),
    ...expensesByOperator.keys(),
  ]);
  const byOperator = new Map<number, OperatorNextPayDueSnapshot>();

  for (const operatorId of operatorIds) {
    const opTrips = tripsByOperator.get(operatorId) ?? [];
    const opExpenses = expensesByOperator.get(operatorId) ?? [];
    const sections = buildOperatorPaymentRows(opTrips, opExpenses, asOf);
    const summary = summarizeOperatorPaymentRows(sections, asOfYmd);
    if (summary.owedAmount <= 0) {
      continue;
    }
    const variant = summary.nextPayDueBadgeVariant;
    byOperator.set(operatorId, {
      dueOn: summary.nextPayDueYmd ?? undefined,
      variant: variant === 'neutral' ? undefined : variant,
      owedAmount: summary.owedAmount,
    });
  }

  return byOperator;
}
