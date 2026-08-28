/** Fin de la exención de 2 años: 1 ene del año modelo + 2 años (`2026` → `2028-01-01`). */
export function fleetModelTwoYearExemptionEndYmd(
  trailerYear: string | number | null | undefined,
): string | null {
  const modelYear = Number.parseInt(String(trailerYear ?? '').trim(), 10);
  if (!Number.isFinite(modelYear) || modelYear < 1950 || modelYear > 2100) {
    return null;
  }
  return `${modelYear + 2}-01-01`;
}

/** True mientras la fecha operativa sea anterior al fin de la exención. */
export function isWithinFleetModelTwoYearExemption(
  trailerYear: string | number | null | undefined,
  todayYmd: string,
): boolean {
  const end = fleetModelTwoYearExemptionEndYmd(trailerYear);
  if (!end) {
    return false;
  }
  return todayYmd < end;
}
