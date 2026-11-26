const OPERATIONAL_TZ = 'America/Mexico_City';

export type NotificationPeriod = 'day' | 'week' | 'month';

export interface NotificationPeriodRange {
  period: NotificationPeriod;
  from: string;
  to: string;
  /** Inicio del rango en UTC para consultas timestamptz. */
  fromAt: Date;
  /** Fin del rango en UTC para consultas timestamptz. */
  toAt: Date;
  /** YYYY-MM-DD de hoy (MX). */
  today: string;
}

function operationalTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return null;
  }
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
  };
}

function formatYmdParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Offset de `timeZone` en `date`: wall-clock-as-UTC − instante real. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  const asIfUtc = Date.UTC(
    Number(map['year']),
    Number(map['month']) - 1,
    Number(map['day']),
    Number(map['hour']),
    Number(map['minute']),
    Number(map['second']),
  );
  return asIfUtc - date.getTime();
}

/** Instant UTC del reloj civil `ymd` + hora en America/Mexico_City. */
function mxWallTimeToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  ms: number,
): Date {
  const parts = parseYmd(ymd);
  if (!parts) {
    return new Date();
  }
  const localAsUtc = Date.UTC(
    parts.y,
    parts.m - 1,
    parts.d,
    hour,
    minute,
    second,
    ms,
  );
  let guess = localAsUtc;
  for (let i = 0; i < 3; i += 1) {
    const offset = timeZoneOffsetMs(new Date(guess), OPERATIONAL_TZ);
    const next = localAsUtc - offset;
    if (next === guess) {
      break;
    }
    guess = next;
  }
  return new Date(guess);
}

/** Aritmética de calendario sobre YYYY-MM-DD (sin depender del TZ del host). */
function ymdAddCalendarDays(ymd: string, days: number): string {
  const parts = parseYmd(ymd);
  if (!parts) {
    return ymd;
  }
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d + days, 12, 0, 0, 0);
  const d = new Date(utc);
  return formatYmdParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function mxWeekday(now = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATIONAL_TZ,
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  return map[weekday] ?? 1;
}

export function ymdAddDays(ymd: string, days: number): string {
  return ymdAddCalendarDays(ymd, days);
}

function ymdEndOfMonth(ymd: string): string {
  const parts = parseYmd(ymd);
  if (!parts) {
    return ymd;
  }
  const lastDay = new Date(Date.UTC(parts.y, parts.m, 0)).getUTCDate();
  return formatYmdParts(parts.y, parts.m, lastDay);
}

function ymdStartOfMonth(ymd: string): string {
  const parts = parseYmd(ymd);
  if (!parts) {
    return ymd;
  }
  return formatYmdParts(parts.y, parts.m, 1);
}

/** Rango inclusivo YYYY-MM-DD según periodo (zona America/Mexico_City). */
export function resolveNotificationPeriodRange(
  period: NotificationPeriod,
  now = new Date(),
): NotificationPeriodRange {
  const today = operationalTodayYmd(now);
  let from = today;
  let to = today;

  if (period === 'week') {
    const weekday = mxWeekday(now);
    from = ymdAddDays(today, -(weekday - 1));
    to = ymdAddDays(from, 6);
  } else if (period === 'month') {
    from = ymdStartOfMonth(today);
    to = ymdEndOfMonth(today);
  }

  // Límites reales del día civil MX → UTC (Railway corre en UTC).
  // Fin inclusivo = inicio del día siguiente MX − 1 ms (evita deriva de ms/DST).
  const fromAt = mxWallTimeToUtc(from, 0, 0, 0, 0);
  const nextDayStart = mxWallTimeToUtc(ymdAddDays(to, 1), 0, 0, 0, 0);
  const toAt = new Date(nextDayStart.getTime() - 1);

  return { period, from, to, fromAt, toAt, today };
}

/** Para pagos vencidos: extiende el inicio hacia atrás sin cambiar el filtro superior. */
export function notificationOverdueFetchFrom(todayYmd: string): string {
  const parts = parseYmd(todayYmd);
  if (!parts) {
    return todayYmd;
  }
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
  const d = new Date(utc);
  d.setUTCMonth(d.getUTCMonth() - 12);
  return formatYmdParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
