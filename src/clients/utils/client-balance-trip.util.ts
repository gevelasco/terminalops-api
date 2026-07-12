import { exposeTripActualSchedule } from 'src/trips/actual-schedule/resolve-exposed-actual-schedule';
import { operationalKmFromStoredTrip } from 'src/trips/trip-operational-distance.util';
import type { Trip } from 'src/trips/entities/trip.entity';
import { parseMoney } from './client-balance-money.util';

export type ClientBalanceTripStatus =
  | 'completed'
  | 'in_transit'
  | 'scheduled'
  | 'cancelled';

export type ClientBalanceTripRow = {
  id: string;
  clientId: string;
  maneuverCode: string;
  status: ClientBalanceTripStatus;
  hasClientBilling: boolean | null | undefined;
  falseManeuver: boolean | null | undefined;
  clientCharge: string | number | null | undefined;
  clientCollectedAt: string | null | undefined;
  creditDays: number | null | undefined;
  dieselAmount: string | number | null | undefined;
  casetasAmount: string | number | null | undefined;
  operatorQuota: string | number | null | undefined;
  perDiemAmount: string | number | null | undefined;
  operationalDistanceKm: number | null | undefined;
  returnAt: string | null | undefined;
  plannedCompletionAt: string | null | undefined;
};

export type ClientBalanceExpenseKind =
  | 'fuel'
  | 'tolls'
  | 'operator_payment'
  | string;

export type ClientBalanceExpenseRow = {
  tripId: string;
  kind: ClientBalanceExpenseKind;
  amount: number;
};

const TRIP_PROGRAMMED_LEDGER_KINDS = new Set<ClientBalanceExpenseKind>([
  'fuel',
  'tolls',
  'operator_payment',
]);

export function mapTripEntityToBalanceRow(trip: Trip): ClientBalanceTripRow {
  const exposedActual = exposeTripActualSchedule(trip);
  const routeDistanceKm = trip.routeDistanceKm ? Number(trip.routeDistanceKm) : null;
  const storedOperationalKm = trip.operationalDistanceKm
    ? Number(trip.operationalDistanceKm)
    : null;

  return {
    id: String(trip.id),
    clientId: String(trip.clientId ?? trip.client?.id ?? ''),
    maneuverCode: trip.maneuverCode,
    status: trip.status as ClientBalanceTripStatus,
    hasClientBilling: trip.hasClientBilling,
    falseManeuver: trip.falseManeuver,
    clientCharge: trip.clientCharge,
    clientCollectedAt: trip.clientCollectedAt?.toISOString() ?? null,
    creditDays: trip.creditDays,
    dieselAmount: trip.dieselAmount,
    casetasAmount: trip.casetasAmount,
    operatorQuota: trip.operatorQuota,
    perDiemAmount: trip.perDiemAmount,
    operationalDistanceKm: operationalKmFromStoredTrip(
      routeDistanceKm,
      storedOperationalKm,
      trip.isRoundTrip,
    ),
    returnAt: exposedActual.returnAt?.toISOString() ?? null,
    plannedCompletionAt: trip.plannedCompletionAt?.toISOString() ?? null,
  };
}

export function tripLedgerExpenses(
  tripId: string,
  expenses: readonly ClientBalanceExpenseRow[],
): ClientBalanceExpenseRow[] {
  const id = tripId.trim();
  return expenses.filter((expense) => expense.tripId.trim() === id);
}

function ledgerCoversTripProgrammedCosts(
  ledger: readonly ClientBalanceExpenseRow[],
): boolean {
  return ledger.some((expense) => TRIP_PROGRAMMED_LEDGER_KINDS.has(expense.kind));
}

export function isTripBillableForReporting(trip: ClientBalanceTripRow): boolean {
  if (trip.hasClientBilling === false) {
    return false;
  }
  if (parseMoney(trip.clientCharge) <= 0) {
    return false;
  }
  if (trip.status === 'completed') {
    return true;
  }
  if (trip.status === 'cancelled' && trip.falseManeuver === true) {
    return true;
  }
  return false;
}

export function isTripClientCollected(trip: ClientBalanceTripRow): boolean {
  const at = trip.clientCollectedAt;
  return typeof at === 'string' && at.trim().length > 0;
}

export function tripRevenue(trip: ClientBalanceTripRow): number {
  if (!isTripBillableForReporting(trip)) {
    return 0;
  }
  return parseMoney(trip.clientCharge);
}

export function tripCollectedRevenue(trip: ClientBalanceTripRow): number {
  return isTripClientCollected(trip) ? tripRevenue(trip) : 0;
}

export function tripCreditReceivable(trip: ClientBalanceTripRow): number {
  return isTripBillableForReporting(trip) && !isTripClientCollected(trip)
    ? tripRevenue(trip)
    : 0;
}

export function tripDirectCost(trip: ClientBalanceTripRow): number {
  return (
    parseMoney(trip.dieselAmount) +
    parseMoney(trip.casetasAmount) +
    parseMoney(trip.operatorQuota) +
    parseMoney(trip.perDiemAmount)
  );
}

export function tripResolvedDirectCost(
  trip: ClientBalanceTripRow,
  expenses: readonly ClientBalanceExpenseRow[] = [],
): number {
  const ledger = tripLedgerExpenses(trip.id, expenses);
  if (ledgerCoversTripProgrammedCosts(ledger)) {
    return ledger.reduce((sum, expense) => sum + expense.amount, 0);
  }
  return tripDirectCost(trip);
}

export function tripKm(trip: ClientBalanceTripRow): number {
  const op = trip.operationalDistanceKm;
  return typeof op === 'number' && Number.isFinite(op) && op > 0 ? op : 0;
}

export function tripCollectionAnchor(trip: ClientBalanceTripRow): Date | null {
  const iso = trip.returnAt?.trim() || trip.plannedCompletionAt?.trim() || '';
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function tripDueDate(trip: ClientBalanceTripRow): Date | null {
  const anchor = tripCollectionAnchor(trip);
  if (!anchor) {
    return null;
  }
  const due = new Date(anchor);
  due.setDate(due.getDate() + Math.max(0, trip.creditDays ?? 0));
  return due;
}
