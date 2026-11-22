import { sameScheduleInstant, scheduleInstantMs } from './trip-schedule-instant.util';
import type { Trip } from './entities/trip.entity';

type ActualField = 'departureAt' | 'arrivedAt' | 'returnAt';

type TripScheduleSlice = Pick<
  Trip,
  | 'status'
  | 'createdAt'
  | 'departureAt'
  | 'arrivedAt'
  | 'returnAt'
  | 'plannedDepartureAt'
  | 'plannedArrivalAt'
  | 'plannedCompletionAt'
>;

function hasSpuriousActualScheduleCluster(trip: TripScheduleSlice): boolean {
  const values = [trip.departureAt, trip.arrivedAt, trip.returnAt].filter(
    (d): d is Date =>
      d instanceof Date && Number.isFinite(d.getTime()),
  );
  if (values.length < 2) {
    return false;
  }
  return values.every((value) => sameScheduleInstant(value, values[0]!));
}

function hasPairedSpuriousDepartureArrival(trip: TripScheduleSlice): boolean {
  if (!trip.departureAt || !trip.arrivedAt) {
    return false;
  }
  return sameScheduleInstant(trip.departureAt, trip.arrivedAt);
}

function hasPairedSpuriousDepartureCompletion(trip: TripScheduleSlice): boolean {
  if (!trip.departureAt || !trip.returnAt) {
    return false;
  }
  return sameScheduleInstant(trip.departureAt, trip.returnAt);
}

function exposedActualDate(
  trip: TripScheduleSlice,
  field: ActualField,
): Date | null {
  const raw = trip[field];
  if (!raw || !(raw instanceof Date) || Number.isNaN(raw.getTime())) {
    return null;
  }
  if (trip.status === 'scheduled') {
    return null;
  }
  if (hasSpuriousActualScheduleCluster(trip)) {
    return null;
  }
  if (
    (field === 'departureAt' || field === 'arrivedAt') &&
    hasPairedSpuriousDepartureArrival(trip)
  ) {
    return null;
  }
  if (
    (field === 'departureAt' || field === 'returnAt') &&
    hasPairedSpuriousDepartureCompletion(trip)
  ) {
    return null;
  }
  if (trip.createdAt && sameScheduleInstant(raw, trip.createdAt)) {
    return null;
  }

  const departureMs = scheduleInstantMs(trip.departureAt);
  const arrivalMs = scheduleInstantMs(trip.arrivedAt);
  const completionMs = scheduleInstantMs(trip.returnAt);
  if (
    field === 'departureAt' &&
    departureMs !== null &&
    arrivalMs !== null &&
    departureMs >= arrivalMs
  ) {
    return null;
  }
  if (
    field === 'returnAt' &&
    completionMs !== null &&
    arrivalMs !== null &&
    completionMs <= arrivalMs
  ) {
    return null;
  }
  return raw;
}

function plannedDate(
  trip: TripScheduleSlice,
  field: ActualField,
): Date | null {
  switch (field) {
    case 'departureAt':
      return trip.plannedDepartureAt ?? null;
    case 'arrivedAt':
      return trip.plannedArrivalAt ?? null;
    case 'returnAt':
      return trip.plannedCompletionAt ?? null;
  }
}

/** Salida operativa: real válida o plan. */
export function tripOperativeDepartureAt(trip: TripScheduleSlice): Date | null {
  return exposedActualDate(trip, 'departureAt') ?? plannedDate(trip, 'departureAt');
}

export function tripOperativeArrivalAt(trip: TripScheduleSlice): Date | null {
  return exposedActualDate(trip, 'arrivedAt') ?? plannedDate(trip, 'arrivedAt');
}

export function tripOperativeCompletionAt(trip: TripScheduleSlice): Date | null {
  return exposedActualDate(trip, 'returnAt') ?? plannedDate(trip, 'returnAt');
}