import { BadRequestException } from '@nestjs/common';

/** Máximo de días inclusivos en `from`/`to` del calendario de gastos. */
export const EXPENSE_CALENDAR_MAX_RANGE_DAYS = 800;

/** Tope de filas de gastos reales cargadas para proyectar el calendario. */
export const EXPENSE_CALENDAR_ACTUAL_MAX_ROWS = 5000;

/** Diferencia inclusiva de días entre dos YMD (`YYYY-MM-DD`). */
export function expenseCalendarInclusiveDaySpan(from: string, to: string): number {
  const fromMs = Date.parse(`${from.trim()}T12:00:00.000Z`);
  const toMs = Date.parse(`${to.trim()}T12:00:00.000Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new BadRequestException('from/to must be valid ISO dates (YYYY-MM-DD)');
  }
  const start = Math.min(fromMs, toMs);
  const end = Math.max(fromMs, toMs);
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** Normaliza y valida el rango del calendario (orden + cap de días). */
export function assertExpenseCalendarDateRange(
  fromRaw: string,
  toRaw: string,
): { from: string; to: string } {
  const a = fromRaw.trim();
  const b = toRaw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) {
    throw new BadRequestException('from/to must be YYYY-MM-DD');
  }
  const from = a <= b ? a : b;
  const to = a <= b ? b : a;
  const days = expenseCalendarInclusiveDaySpan(from, to);
  if (days > EXPENSE_CALENDAR_MAX_RANGE_DAYS) {
    throw new BadRequestException(
      `El rango del calendario no puede superar ${EXPENSE_CALENDAR_MAX_RANGE_DAYS} días (recibido: ${days}).`,
    );
  }
  return { from, to };
}
