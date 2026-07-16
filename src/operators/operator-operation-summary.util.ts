import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import type { Unit } from 'src/units/entities/unit.entity';
import { buildEquipmentOperationalId, buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';
import { operationalKmFromStoredTrip } from 'src/trips/trip-operational-distance.util';
import {
  buildOperatorPaymentRows,
  summarizeOperatorPaymentRows,
} from './operator-payment-rows.util';
import {
  normalizeOperatorPaymentSchedule,
} from './operator-payment-schedule.util';
import type {
  OperatorActiveAssignmentDto,
  OperatorOperationSummaryDto,
} from './dto/operator-operation-summary.dto';

type TripLike = Pick<
  Trip,
  | 'id'
  | 'maneuverCode'
  | 'origin'
  | 'destination'
  | 'clientId'
  | 'clientName'
  | 'unitId'
  | 'status'
  | 'operatorQuota'
  | 'departureAt'
  | 'returnAt'
  | 'arrivedAt'
  | 'plannedDepartureAt'
  | 'plannedCompletionAt'
  | 'completedAt'
  | 'creditDays'
  | 'routeDistanceKm'
  | 'operationalDistanceKm'
  | 'isRoundTrip'
  | 'unitOperationalCodeSnapshot'
  | 'tripEquipment'
  | 'unit'
>;

export const OPERATOR_SUMMARY_RECENT_DAYS = 30;

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

function tripKm(trip: TripLike): number {
  const km = operationalKmFromStoredTrip(
    trip.routeDistanceKm != null ? Number(trip.routeDistanceKm) : null,
    trip.operationalDistanceKm != null ? Number(trip.operationalDistanceKm) : null,
    trip.isRoundTrip,
  );
  return km != null && Number.isFinite(km) ? km : 0;
}

function formatTripRouteLabel(origin: string, destination: string): string {
  return `${origin} → ${destination}`;
}

function labelForUnit(trip: TripLike, unitsById: ReadonlyMap<number, Unit>): string {
  const snapshot = trip.unitOperationalCodeSnapshot?.trim();
  if (snapshot) {
    return snapshot;
  }
  if (trip.unit) {
    return buildUnitOperationalId(trip.unit);
  }
  const unitId = trip.unitId;
  if (unitId == null) {
    return 'Sin asignar';
  }
  const unit = unitsById.get(unitId);
  return unit ? buildUnitOperationalId(unit) : String(unitId);
}

function equipmentLabels(trip: TripLike): string {
  const rows = trip.tripEquipment ?? [];
  if (rows.length === 0) {
    return '—';
  }
  const labels = rows
    .map((row) => {
      const eq = row.equipment;
      return eq ? buildEquipmentOperationalId(eq) : String(row.equipmentId);
    })
    .filter((label) => label.trim().length > 0);
  return labels.length > 0 ? labels.join(' · ') : '—';
}

function tripActivityYmd(
  trip: Pick<
    TripLike,
    | 'completedAt'
    | 'returnAt'
    | 'arrivedAt'
    | 'departureAt'
    | 'plannedDepartureAt'
  >,
): string | null {
  for (const value of [
    trip.completedAt,
    trip.returnAt,
    trip.arrivedAt,
    trip.departureAt,
    trip.plannedDepartureAt,
  ]) {
    if (!value) {
      continue;
    }
    const d = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return localYmd(d);
    }
  }
  return null;
}

function isTripWithinRecentDays(
  trip: TripLike,
  asOfYmd: string,
  dayCount: number,
): boolean {
  const activityYmd = tripActivityYmd(trip);
  if (!activityYmd) {
    return false;
  }
  const fromYmd = addDaysYmd(asOfYmd, -(dayCount - 1));
  return activityYmd >= fromYmd && activityYmd <= asOfYmd;
}

function countTripsByStatus(
  trips: readonly TripLike[],
): OperatorOperationSummaryDto['statusCounts'] {
  const statusCounts = {
    completed: 0,
    inTransit: 0,
    scheduled: 0,
    cancelled: 0,
    total: trips.length,
  };
  for (const t of trips) {
    switch (t.status) {
      case 'completed':
        statusCounts.completed += 1;
        break;
      case 'in_transit':
        statusCounts.inTransit += 1;
        break;
      case 'scheduled':
        statusCounts.scheduled += 1;
        break;
      case 'cancelled':
        statusCounts.cancelled += 1;
        break;
      default:
        break;
    }
  }
  return statusCounts;
}

function buildActiveAssignment(
  trips: readonly TripLike[],
  unitsById: ReadonlyMap<number, Unit>,
): OperatorActiveAssignmentDto | null {
  const active =
    trips.find((t) => t.status === 'in_transit') ??
    trips.find((t) => t.status === 'scheduled');
  if (!active) {
    return null;
  }
  return {
    maneuverCode: active.maneuverCode,
    routeLabel: formatTripRouteLabel(active.origin, active.destination),
    clientName: active.clientName?.trim() || '—',
    unitLabel: labelForUnit(active, unitsById),
    equipmentLabel: equipmentLabels(active),
    statusLabel: active.status === 'in_transit' ? 'En curso' : 'Programada',
  };
}

export function buildOperatorOperationSummary(
  trips: readonly TripLike[],
  expenses: readonly Expense[],
  unitsById: ReadonlyMap<number, Unit>,
  asOf: Date = new Date(),
  paymentScheduleRaw?: string | null,
  periodFrom?: string,
  periodTo?: string,
): OperatorOperationSummaryDto {
  const asOfYmd = localYmd(asOf);
  const paymentSchedule = normalizeOperatorPaymentSchedule(paymentScheduleRaw);

  const usePeriod = !!periodFrom && !!periodTo;
  const scopedTrips = usePeriod
    ? trips.filter((t) => {
        const ymd = tripActivityYmd(t);
        return ymd != null && ymd >= periodFrom && ymd <= periodTo;
      })
    : trips.filter((trip) =>
        isTripWithinRecentDays(trip, asOfYmd, OPERATOR_SUMMARY_RECENT_DAYS),
      );

  const statusCounts = countTripsByStatus(scopedTrips);

  const completedKm = Math.round(
    scopedTrips
      .filter((t) => t.status === 'completed')
      .reduce((sum, t) => sum + tripKm(t), 0),
  );

  const paymentSections = buildOperatorPaymentRows(
    trips,
    expenses,
    paymentSchedule,
    asOf,
    usePeriod ? periodFrom : undefined,
    usePeriod ? periodTo : undefined,
  );
  const paymentSummary = summarizeOperatorPaymentRows(paymentSections, asOfYmd);

  return {
    hasTrips: trips.length > 0,
    statusCounts,
    completedKm,
    activeAssignment: buildActiveAssignment(trips, unitsById),
    owedTripCount: paymentSummary.owedTripCount,
    owedAmount: paymentSummary.owedAmount,
    nextPayDueYmd: paymentSummary.nextPayDueYmd,
    nextPayDueLabel: paymentSummary.nextPayDueLabel,
    nextPayDueBadgeVariant: paymentSummary.nextPayDueBadgeVariant,
    pendingPaymentRows: paymentSections.pendingPaymentRows,
    recentPaymentRows: paymentSections.recentPaymentRows,
  };
}
