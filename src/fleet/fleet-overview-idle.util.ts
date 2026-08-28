const MS_PER_DAY = 86_400_000;
const OPERATIONAL_TZ = 'America/Mexico_City';

function operationalDayIndex(epochMs: number, timeZone = OPERATIONAL_TZ): number {
  const key = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(epochMs));
  const [y, m, d] = key.split('-').map((v) => parseInt(v, 10));
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Días calendario (MX) desde el fin de la última maniobra hasta hoy. */
export function daysWithoutManeuverSince(lastEndedAt: Date, now = new Date()): number {
  const endMs = lastEndedAt.getTime();
  const nowMs = now.getTime();
  if (!Number.isFinite(endMs) || !Number.isFinite(nowMs) || nowMs <= endMs) {
    return 0;
  }
  const endDay = operationalDayIndex(endMs);
  const nowDay = operationalDayIndex(nowMs);
  return Math.max(0, nowDay - endDay);
}

/**
 * Fin real de la maniobra de la unidad: llegada a origen, o el sello de
 * completada si aún no hay return. No usa plan, canceladas ni updated_at.
 */
export function resolveTripEndedAt(trip: {
  returnAt?: Date | null;
  completedAt?: Date | null;
}): Date | null {
  const candidates = [trip.returnAt, trip.completedAt];
  for (const value of candidates) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }
  }
  return null;
}
