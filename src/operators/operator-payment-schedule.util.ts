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

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

function lastDayOfMonthYmd(year: number, monthIndex: number): string {
  return localYmd(new Date(year, monthIndex + 1, 0, 12, 0, 0));
}

function monthPayCandidates(year: number, monthIndex: number): string[] {
  const ym = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return [`${ym}-15`, lastDayOfMonthYmd(year, monthIndex)];
}

/** Próximo sábado (incluye hoy si es sábado). */
export function nextWeeklyPayDueYmd(asOfYmd: string): string {
  const d = parseYmd(asOfYmd);
  const day = d.getDay();
  const daysUntilSaturday = day === 6 ? 0 : (6 - day + 7) % 7;
  d.setDate(d.getDate() + daysUntilSaturday);
  return localYmd(d);
}

/** Sábado de pago inmediatamente anterior a `asOfYmd`. */
export function previousWeeklyPayDueYmd(asOfYmd: string): string | null {
  const d = parseYmd(asOfYmd);
  const day = d.getDay();
  const daysSinceSaturday = day === 6 ? 7 : (day + 1) % 7 || 7;
  d.setDate(d.getDate() - daysSinceSaturday);
  return localYmd(d);
}

export function nextBiweeklyPayDueYmd(asOfYmd: string): string {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  for (let i = 0; i < 24; i += 1) {
    for (const candidate of monthPayCandidates(year, month)) {
      if (candidate >= asOfYmd) {
        return candidate;
      }
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return asOfYmd;
}

export function previousBiweeklyPayDueYmd(asOfYmd: string): string | null {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  const prior: string[] = [];
  for (let i = 0; i < 24; i += 1) {
    prior.push(...monthPayCandidates(year, month));
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  const filtered = prior.filter((ymd) => ymd < asOfYmd).sort();
  return filtered.length > 0 ? filtered[filtered.length - 1]! : null;
}

export function nextMonthlyPayDueYmd(asOfYmd: string): string {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  for (let i = 0; i < 24; i += 1) {
    const candidate = lastDayOfMonthYmd(year, month);
    if (candidate >= asOfYmd) {
      return candidate;
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return asOfYmd;
}

export function previousMonthlyPayDueYmd(asOfYmd: string): string | null {
  const start = parseYmd(asOfYmd);
  let year = start.getFullYear();
  let month = start.getMonth();
  const prior: string[] = [];
  for (let i = 0; i < 24; i += 1) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    prior.push(lastDayOfMonthYmd(year, month));
  }
  const filtered = prior.filter((ymd) => ymd < asOfYmd).sort();
  return filtered.length > 0 ? filtered[filtered.length - 1]! : null;
}

export function nextPeriodicPayDueYmd(
  schedule: Exclude<OperatorPaymentSchedule, 'maneuver'>,
  asOfYmd: string,
): string {
  switch (schedule) {
    case 'weekly':
      return nextWeeklyPayDueYmd(asOfYmd);
    case 'biweekly':
      return nextBiweeklyPayDueYmd(asOfYmd);
    case 'monthly':
      return nextMonthlyPayDueYmd(asOfYmd);
  }
}

export function previousPeriodicPayDueYmd(
  schedule: Exclude<OperatorPaymentSchedule, 'maneuver'>,
  asOfYmd: string,
): string | null {
  switch (schedule) {
    case 'weekly':
      return previousWeeklyPayDueYmd(asOfYmd);
    case 'biweekly':
      return previousBiweeklyPayDueYmd(asOfYmd);
    case 'monthly':
      return previousMonthlyPayDueYmd(asOfYmd);
  }
}

export function tripCompletionAnchorYmd(
  trip: Pick<Trip, 'returnAt' | 'plannedCompletionAt' | 'completedAt' | 'arrivedAt'>,
): string | null {
  for (const value of [
    trip.returnAt,
    trip.completedAt,
    trip.arrivedAt,
    trip.plannedCompletionAt,
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

/** Fecha planeada de término (sin fechas reales de cierre). */
export function tripPlannedCompletionAnchorYmd(
  trip: Pick<Trip, 'plannedCompletionAt'>,
): string | null {
  const value = trip.plannedCompletionAt;
  if (!value) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : localYmd(d);
}

/**
 * Ancla para proyectar pago al operador:
 * - programada / en tránsito sin cierre real → `plannedCompletionAt`
 * - con cierre real o completada → fechas reales (return, completed, arrived)
 */
export function tripPayProjectionAnchorYmd(
  trip: Pick<
    Trip,
    | 'status'
    | 'returnAt'
    | 'plannedCompletionAt'
    | 'completedAt'
    | 'arrivedAt'
  >,
): string | null {
  if (trip.status === 'completed') {
    return tripCompletionAnchorYmd(trip);
  }
  if (trip.status === 'scheduled' || trip.status === 'in_transit') {
    const hasRealCompletion = [trip.returnAt, trip.completedAt, trip.arrivedAt].some(
      (value) => value != null && String(value).trim() !== '',
    );
    if (hasRealCompletion) {
      return tripCompletionAnchorYmd(trip);
    }
    return tripPlannedCompletionAnchorYmd(trip);
  }
  return null;
}

/**
 * Fecha de pago proyectada para una maniobra según método del operador.
 * Ej.: término planeado martes + pago semanal → sábado de esa semana.
 */
export function resolveProjectedOperatorPayDueYmd(
  schedule: OperatorPaymentSchedule,
  tripAnchorYmd: string,
): string {
  if (schedule === 'maneuver') {
    return tripAnchorYmd;
  }
  return nextPeriodicPayDueYmd(schedule, tripAnchorYmd);
}

/** Fecha de alerta/pago para una maniobra con saldo pendiente (al concluir). */
export function maneuverTripPayDueYmd(
  trip: Pick<
    Trip,
    'returnAt' | 'plannedCompletionAt' | 'completedAt' | 'arrivedAt' | 'creditDays'
  >,
): string | null {
  return tripCompletionAnchorYmd(trip);
}

/**
 * Próxima fecha de alerta de pago al operador según método de cobro.
 * Con saldo pendiente y ciclos vencidos, muestra el último día de pago vencido.
 */
export function resolveOperatorPayAlertDueYmd(
  schedule: OperatorPaymentSchedule,
  asOfYmd: string,
  unpaidTripCompletionYmds: readonly string[],
): string | null {
  if (unpaidTripCompletionYmds.length === 0) {
    return null;
  }

  if (schedule === 'maneuver') {
    return [...unpaidTripCompletionYmds].sort()[0] ?? null;
  }

  const previous = previousPeriodicPayDueYmd(schedule, asOfYmd);
  const hasOverdueCycle =
    previous != null &&
    previous < asOfYmd &&
    unpaidTripCompletionYmds.some((ymd) => ymd <= previous);

  if (hasOverdueCycle) {
    return previous;
  }

  return nextPeriodicPayDueYmd(schedule, asOfYmd);
}

/** Fecha mostrada por maniobra en el detalle de pagos pendientes. */
export function resolveTripPayRowDueYmd(
  schedule: OperatorPaymentSchedule,
  asOfYmd: string,
  tripCompletionYmd: string | null,
  batchDueYmd: string | null,
): string {
  if (schedule === 'maneuver') {
    return tripCompletionYmd ?? asOfYmd;
  }
  return batchDueYmd ?? tripCompletionYmd ?? asOfYmd;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return localYmd(d);
}

export function weeklyPeriodBounds(weekDueSaturdayYmd: string): {
  from: string;
  to: string;
} {
  const previousSaturday = previousWeeklyPayDueYmd(weekDueSaturdayYmd);
  const from = previousSaturday
    ? addDaysYmd(previousSaturday, 1)
    : addDaysYmd(weekDueSaturdayYmd, -6);
  return { from, to: weekDueSaturdayYmd };
}

export function biweeklyPeriodBounds(dueYmd: string): { from: string; to: string } {
  const ym = dueYmd.slice(0, 7);
  const day = Number(dueYmd.slice(8, 10));
  if (day <= 15) {
    return { from: `${ym}-01`, to: `${ym}-15` };
  }
  const monthIndex = Number(dueYmd.slice(5, 7)) - 1;
  const year = Number(dueYmd.slice(0, 4));
  return { from: `${ym}-16`, to: lastDayOfMonthYmd(year, monthIndex) };
}

export function monthlyPeriodBounds(dueYmd: string): { from: string; to: string } {
  const ym = dueYmd.slice(0, 7);
  const monthIndex = Number(dueYmd.slice(5, 7)) - 1;
  const year = Number(dueYmd.slice(0, 4));
  return { from: `${ym}-01`, to: lastDayOfMonthYmd(year, monthIndex) };
}

export function currentPeriodicPayPeriodDueYmd(
  schedule: Exclude<OperatorPaymentSchedule, 'maneuver'>,
  asOfYmd: string,
): string {
  return nextPeriodicPayDueYmd(schedule, asOfYmd);
}

export function tripBelongsToPayPeriod(
  completionYmd: string,
  schedule: Exclude<OperatorPaymentSchedule, 'maneuver'>,
  periodDueYmd: string,
): boolean {
  let bounds: { from: string; to: string };
  switch (schedule) {
    case 'weekly':
      bounds = weeklyPeriodBounds(periodDueYmd);
      break;
    case 'biweekly':
      bounds = biweeklyPeriodBounds(periodDueYmd);
      break;
    case 'monthly':
      bounds = monthlyPeriodBounds(periodDueYmd);
      break;
  }
  return completionYmd >= bounds.from && completionYmd <= bounds.to;
}
