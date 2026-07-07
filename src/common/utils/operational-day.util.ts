export const OPERATIONAL_TIMEZONE = 'America/Mexico_City';

/** Fecha calendario operativa `YYYY-MM-DD` (zona México). */
export function operationalDateKey(
  at: Date = new Date(),
  timeZone = OPERATIONAL_TIMEZONE,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Compara columna `timestamptz` con el día calendario actual (MX), sin ventanas de 24 h. */
export function sqlIsOperationalCalendarToday(column: string): string {
  return `(${column} AT TIME ZONE '${OPERATIONAL_TIMEZONE}')::date = (NOW() AT TIME ZONE '${OPERATIONAL_TIMEZONE}')::date`;
}

/** Rango de semana calendario (lunes–domingo) en zona MX para SQL. `weekOffset`: 0 = semana actual, -1 = anterior. */
export function sqlOperationalCalendarWeekRange(
  column: string,
  weekOffset: 0 | -1 = 0,
): string {
  const weekStart =
    weekOffset === 0
      ? `date_trunc('week', (NOW() AT TIME ZONE '${OPERATIONAL_TIMEZONE}')::timestamp)`
      : `date_trunc('week', (NOW() AT TIME ZONE '${OPERATIONAL_TIMEZONE}')::timestamp) - interval '7 days'`;
  const weekEnd = `${weekStart} + interval '7 days'`;
  return `(${column} AT TIME ZONE '${OPERATIONAL_TIMEZONE}') >= ${weekStart} AND (${column} AT TIME ZONE '${OPERATIONAL_TIMEZONE}') < ${weekEnd}`;
}
