export function parseStoredKm(value: string | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatStoredKm(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function resolveMaintenanceKmInterval(
  _profileInterval: string | null | undefined,
  companyKmControlEnabled: boolean,
  companyIntervalDefault: string | null | undefined,
): number | null {
  if (!companyKmControlEnabled) {
    return null;
  }
  const companyInterval = parseStoredKm(companyIntervalDefault);
  return companyInterval != null && companyInterval > 0 ? companyInterval : null;
}

export function maintenanceKmControlActive(
  _profileAlertByKm: boolean | null | undefined,
  companyKmControlEnabled: boolean,
): boolean {
  return companyKmControlEnabled;
}
