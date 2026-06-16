export const TRIP_LIFECYCLE_STATUSES = [
  'scheduled',
  'in_transit',
  'completed',
  'cancelled',
] as const;

export type TripLifecycleStatus = (typeof TRIP_LIFECYCLE_STATUSES)[number];

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
  openIncidentCount: number;
  now?: Date;
}

export interface TripLifecycleEvaluationResult {
  nextStatus: TripLifecycleStatus | null;
}
