import type { TripDelayPhase } from './trip-lifecycle.types';

export interface TripDelayInput {
  status: string;
  plannedDepartureAt: Date;
  plannedArrivalAt: Date;
  plannedCompletionAt: Date;
  actualDepartureAt?: Date | null;
  actualArrivalAt?: Date | null;
  actualCompletionAt?: Date | null;
  now?: Date;
}

export interface TripDelayMetrics {
  isDelayed: boolean;
  delayPhase: TripDelayPhase;
  delayDepartureMinutes: number | null;
  delayArrivalMinutes: number | null;
  delayCompletionMinutes: number | null;
}

function minutesBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 60_000);
}

export function calculateTripDelays(input: TripDelayInput): TripDelayMetrics {
  const now = input.now ?? new Date();
  const none: TripDelayMetrics = {
    isDelayed: false,
    delayPhase: 'none',
    delayDepartureMinutes: null,
    delayArrivalMinutes: null,
    delayCompletionMinutes: null,
  };

  if (input.status === 'completed' || input.status === 'cancelled') {
    return none;
  }

  let delayDepartureMinutes: number | null = null;
  let delayArrivalMinutes: number | null = null;
  let delayCompletionMinutes: number | null = null;

  if (input.actualDepartureAt) {
    delayDepartureMinutes = minutesBetween(
      input.actualDepartureAt,
      input.plannedDepartureAt,
    );
  } else if (
    input.status === 'scheduled' &&
    now.getTime() > input.plannedDepartureAt.getTime()
  ) {
    delayDepartureMinutes = minutesBetween(now, input.plannedDepartureAt);
  }

  if (input.actualArrivalAt) {
    delayArrivalMinutes = minutesBetween(
      input.actualArrivalAt,
      input.plannedArrivalAt,
    );
  } else if (
    (input.status === 'scheduled' || input.status === 'in_transit') &&
    (input.actualDepartureAt || now.getTime() > input.plannedDepartureAt.getTime()) &&
    now.getTime() > input.plannedArrivalAt.getTime()
  ) {
    delayArrivalMinutes = minutesBetween(now, input.plannedArrivalAt);
  }

  if (input.actualCompletionAt) {
    delayCompletionMinutes = minutesBetween(
      input.actualCompletionAt,
      input.plannedCompletionAt,
    );
  } else if (
    input.status === 'in_transit' &&
    now.getTime() > input.plannedCompletionAt.getTime()
  ) {
    delayCompletionMinutes = minutesBetween(now, input.plannedCompletionAt);
  }

  let delayPhase: TripDelayPhase = 'none';
  if ((delayCompletionMinutes ?? 0) > 0) {
    delayPhase = 'completion';
  } else if ((delayArrivalMinutes ?? 0) > 0) {
    delayPhase = 'arrival';
  } else if ((delayDepartureMinutes ?? 0) > 0) {
    delayPhase = 'departure';
  }

  const isDelayed = delayPhase !== 'none';

  return {
    isDelayed,
    delayPhase,
    delayDepartureMinutes:
      delayDepartureMinutes != null && delayDepartureMinutes > 0
        ? delayDepartureMinutes
        : null,
    delayArrivalMinutes:
      delayArrivalMinutes != null && delayArrivalMinutes > 0
        ? delayArrivalMinutes
        : null,
    delayCompletionMinutes:
      delayCompletionMinutes != null && delayCompletionMinutes > 0
        ? delayCompletionMinutes
        : null,
  };
}
