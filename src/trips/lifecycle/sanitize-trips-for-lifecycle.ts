import type { Trip } from '../entities/trip.entity';

type TripPlannedFields = Pick<
  Trip,
  'plannedDepartureAt' | 'plannedArrivalAt' | 'plannedCompletionAt'
>;

export interface TripLifecycleSanitizedRow<T extends TripPlannedFields> {
  trip: T;
  /** true cuando faltan planned_* requeridos por el lifecycle engine (solo diagnóstico). */
  invalidForLifecycle: boolean;
}

/**
 * Marca trips con planned_* incompletos para diagnóstico.
 * No modifica datos ni genera fechas — solo lectura en memoria.
 */
export function sanitizeTripsForLifecycle<T extends TripPlannedFields>(
  trips: T[],
): TripLifecycleSanitizedRow<T>[] {
  return trips.map((trip) => ({
    trip,
    invalidForLifecycle: isTripInvalidForLifecycle(trip),
  }));
}

export function isTripInvalidForLifecycle(trip: TripPlannedFields): boolean {
  return (
    trip.plannedDepartureAt == null ||
    trip.plannedArrivalAt == null ||
    trip.plannedCompletionAt == null
  );
}
