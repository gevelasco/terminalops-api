import type { Trip } from 'src/trips/entities/trip.entity';

export type OperatorPaymentSchedule =
  | 'maneuver'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export function normalizeOperatorPaymentSchedule(
  raw: string | null | undefined,
): OperatorPaymentSchedule {
  if (raw === 'weekly' || raw === 'biweekly' || raw === 'monthly') {
    return raw;
  }
  return 'maneuver';
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function tripCompletionAnchorYmd(
  trip: Pick<Trip, 'returnAt' | 'plannedCompletionAt' | 'completedAt' | 'arrivedAt'>,
): string | null {
  for (const value of [
    trip.returnAt,
    trip.plannedCompletionAt,
    trip.completedAt,
    trip.arrivedAt,
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
