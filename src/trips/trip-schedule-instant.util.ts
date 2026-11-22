/** Comparación laxa de instantes de cronograma (ms, con tolerancia 60s). */
export function sameScheduleInstant(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined,
): boolean {
  const msA = scheduleInstantMs(a);
  const msB = scheduleInstantMs(b);
  if (msA == null || msB == null) {
    return false;
  }
  return Math.abs(msA - msB) <= 60_000;
}

export function scheduleInstantMs(
  value: Date | string | null | undefined,
): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const raw = value?.toString().trim();
  if (!raw) {
    return null;
  }
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}