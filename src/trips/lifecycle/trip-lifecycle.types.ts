export const TRIP_LIFECYCLE_STATUSES = [
  'scheduled',
  'in_transit',
  'completed',
  'cancelled',
] as const;

export type TripLifecycleStatus = (typeof TRIP_LIFECYCLE_STATUSES)[number];

/** Maniobras que el motor puede transicionar o recalcular retrasos (excluye completed/cancelled). */
export const ACTIVE_TRIP_LIFECYCLE_STATUSES = [
  'scheduled',
  'in_transit',
] as const satisfies readonly TripLifecycleStatus[];

export type ActiveTripLifecycleStatus =
  (typeof ACTIVE_TRIP_LIFECYCLE_STATUSES)[number];

export const TRIP_DELAY_PHASES = [
  'none',
  'departure',
  'arrival',
  'completion',
] as const;

export type TripDelayPhase = (typeof TRIP_DELAY_PHASES)[number];

export const LIFECYCLE_ENGINE_REASON = 'lifecycle_engine';

export interface TripLifecycleEvaluationInput {
  status: TripLifecycleStatus;
  plannedDepartureAt: Date;
  plannedCompletionAt: Date;
  /** Fin real (`return_at`); si existe, prevalece sobre el fin planeado. */
  actualCompletionAt?: Date | null;
  now?: Date;
}

export interface TripLifecycleEvaluationResult {
  nextStatus: TripLifecycleStatus | null;
}
