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

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Mediodía local MX como Date UTC-safe para comparaciones de día. */
function mxNoonDate(ymd: string): Date {
  const parts = parseYmd(ymd);
  if (!parts) {
    return new Date();
  }
  return new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
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

function ymdAddDays(ymd: string, days: number): string {
  const base = mxNoonDate(ymd);
  base.setDate(base.getDate() + days);
  return formatYmd(base);
}

function ymdEndOfMonth(ymd: string): string {
  const parts = parseYmd(ymd);
  if (!parts) {
    return ymd;
  }
  const lastDay = new Date(parts.y, parts.m, 0).getDate();
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function ymdStartOfMonth(ymd: string): string {
  const parts = parseYmd(ymd);
  if (!parts) {
    return ymd;
  }
  return `${parts.y}-${String(parts.m).padStart(2, '0')}-01`;
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

  const fromAt = mxNoonDate(from);
  fromAt.setHours(0, 0, 0, 0);
  const toAt = mxNoonDate(to);
  toAt.setHours(23, 59, 59, 999);

  return { period, from, to, fromAt, toAt, today };
}

/** Para pagos vencidos: extiende el inicio hacia atrás sin cambiar el filtro superior. */
export function notificationOverdueFetchFrom(todayYmd: string): string {
  const parts = parseYmd(todayYmd);
  if (!parts) {
    return todayYmd;
  }
  const d = new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
  d.setMonth(d.getMonth() - 12);
  return formatYmd(d);
}
