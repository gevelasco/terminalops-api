export function normalizePersistedFleetStatus(
  status: string | null | undefined,
): string {
  return (status ?? '').trim().toLowerCase() || 'available';
}

export function canPersistedStatusEnterMaintenance(
  status: string | null | undefined,
): boolean {
  return normalizePersistedFleetStatus(status) === 'available';
}

export function canPersistedStatusLeaveMaintenance(
  status: string | null | undefined,
): boolean {
  return normalizePersistedFleetStatus(status) === 'maintenance';
}
