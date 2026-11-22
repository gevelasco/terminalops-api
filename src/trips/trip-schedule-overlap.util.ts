import type { Trip } from './entities/trip.entity';
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';

export type TripScheduleWindow = {
  startMs: number;
  endMs: number;
};

export function tripScheduleWindowFromEntity(trip: {
  plannedDepartureAt: Date;
  plannedCompletionAt: Date;
  returnAt?: Date | null;
}): TripScheduleWindow {
  const startMs = trip.plannedDepartureAt.getTime();
  const endDate = trip.returnAt ?? trip.plannedCompletionAt;
  const endMs = Math.max(startMs, endDate.getTime());
  return { startMs, endMs };
}

export function tripScheduleWindowFromCandidate(
  plannedDepartureAt: Date,
  plannedCompletionAt: Date,
): TripScheduleWindow {
  const startMs = plannedDepartureAt.getTime();
  const endMs = Math.max(startMs, plannedCompletionAt.getTime());
  return { startMs, endMs };
}

/** Solape estricto; comparten instante de fin/inicio sin solaparse. */
export function tripScheduleWindowsOverlap(
  a: TripScheduleWindow,
  b: TripScheduleWindow,
): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function isActiveOperationalTripStatus(status: string): boolean {
  return (TRIP_FLEET_ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function tripsShareFleetResources(
  a: Pick<Trip, 'unitId' | 'operatorId'>,
  b: Pick<Trip, 'unitId' | 'operatorId'>,
  equipmentIdsA: readonly number[] = [],
  equipmentIdsB: readonly number[] = [],
): boolean {
  if (a.unitId != null && b.unitId != null && a.unitId === b.unitId) {
    return true;
  }
  if (
    a.operatorId != null &&
    b.operatorId != null &&
    a.operatorId === b.operatorId
  ) {
    return true;
  }
  if (equipmentIdsA.length > 0 && equipmentIdsB.length > 0) {
    const setB = new Set(equipmentIdsB);
    return equipmentIdsA.some((id) => setB.has(id));
  }
  return false;
}

export function findScheduleOverlapsAmongTrips(
  candidate: TripScheduleWindow,
  trips: readonly Trip[],
  subject: Pick<Trip, 'id' | 'unitId' | 'operatorId'>,
  subjectEquipmentIds: readonly number[] = [],
  excludeTripId?: number,
): Trip[] {
  const out: Trip[] = [];
  for (const trip of trips) {
    if (!isActiveOperationalTripStatus(trip.status)) {
      continue;
    }
    if (excludeTripId != null && trip.id === excludeTripId) {
      continue;
    }
    const otherWindow = tripScheduleWindowFromEntity(trip);
    if (!tripScheduleWindowsOverlap(candidate, otherWindow)) {
      continue;
    }
    const tripEquip = (trip.tripEquipment ?? []).map((row) => row.equipmentId);
    if (
      tripsShareFleetResources(subject, trip, subjectEquipmentIds, tripEquip)
    ) {
      out.push(trip);
    }
  }
  return out;
}