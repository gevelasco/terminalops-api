/** Días tras el completado en que aún se permite entrega de vacío y bitácora. */
export const TRIP_POST_COMPLETION_EDIT_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TripFollowUpLockInput = {
  status?: string | null;
  completedAt?: Date | string | null;
  returnAt?: Date | string | null;
};

function completionInstantMs(trip: TripFollowUpLockInput): number | null {
  const raw = trip.completedAt ?? trip.returnAt ?? null;
  if (raw == null || raw === '') {
    return null;
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Maniobra completada hace más de 7 días: sin entrega de vacío ni bitácora nueva.
 */
export function isTripFollowUpLocked(
  trip: TripFollowUpLockInput | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!trip || trip.status !== 'completed') {
    return false;
  }
  const completedMs = completionInstantMs(trip);
  if (completedMs == null) {
    return true;
  }
  const deadlineMs = completedMs + TRIP_POST_COMPLETION_EDIT_DAYS * MS_PER_DAY;
  return nowMs > deadlineMs;
}
