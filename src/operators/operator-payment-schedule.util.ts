import type { Trip } from 'src/trips/entities/trip.entity';
import {
  formatOperationalIncurredDateYmd,
  parseOperationalIncurredAt,
} from 'src/expenses/expenses-incurred-at.util';

export type OperatorPaymentSchedule =
  | 'maneuver'
  | 'weekly'
  | 'biweekly'
  | 'monthly';

export type WeeklyPayDay =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun';

const WEEKLY_PAY_DAYS: readonly WeeklyPayDay[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

const WEEKLY_PAY_DAY_TO_JS_DOW: Record<WeeklyPayDay, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export function normalizeOperatorPaymentSchedule(
  raw: string | null | undefined,
): OperatorPaymentSchedule {
  if (raw === 'weekly' || raw === 'biweekly' || raw === 'monthly') {
    return raw;
  }
  return 'maneuver';
}

export function normalizeWeeklyPayDay(
  raw: string | null | undefined,
): WeeklyPayDay | null {
  const key = raw?.trim().toLowerCase();
  if (key && (WEEKLY_PAY_DAYS as readonly string[]).includes(key)) {
    return key as WeeklyPayDay;
  }
  return null;
}

function weekdayIndexOperationalMx(ymd: string): number {
  const d = parseOperationalIncurredAt(ymd);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

function addOperationalDaysYmd(ymd: string, days: number): string {
  const d = parseOperationalIncurredAt(ymd);
  d.setTime(d.getTime() + days * 86_400_000);
  return formatOperationalIncurredDateYmd(d);
}

/**
 * Vencimiento semanal: día de pago de la semana de la conclusión, salvo que
 * la maniobra termine después de ese día — entonces la siguiente ocurrencia.
 */
export function resolveWeeklyOperatorPaymentDueYmd(
  completionYmd: string,
  weeklyPayDay: WeeklyPayDay,
): string {
  const targetDow = WEEKLY_PAY_DAY_TO_JS_DOW[weeklyPayDay];
  const completionDow = weekdayIndexOperationalMx(completionYmd);
  let daysUntil =
    targetDow >= completionDow
      ? targetDow - completionDow
      : 7 - (completionDow - targetDow);
  if (daysUntil < 0) {
    daysUntil = 0;
  }
  return addOperationalDaysYmd(completionYmd, daysUntil);
}

export function resolveOperatorPaymentDueYmd(params: {
  completionYmd: string;
  paymentSchedule?: string | null;
  weeklyPayDay?: string | null;
}): string {
  const schedule = normalizeOperatorPaymentSchedule(params.paymentSchedule);
  if (schedule === 'weekly') {
    const day = normalizeWeeklyPayDay(params.weeklyPayDay) ?? 'fri';
    return resolveWeeklyOperatorPaymentDueYmd(params.completionYmd, day);
  }
  return params.completionYmd;
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

/** Fin efectivo de maniobra en fecha operativa (America/Mexico_City). */
export function tripCompletionAnchorOperationalYmd(
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
      return formatOperationalIncurredDateYmd(d);
    }
  }
  return null;
}
