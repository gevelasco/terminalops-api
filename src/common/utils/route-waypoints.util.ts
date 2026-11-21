export type StoredRouteWaypoint = {
  label: string;
  lat: number;
  lon: number;
  searchLabel?: string;
};

export function normalizeRouteWaypoints(raw: unknown): StoredRouteWaypoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: StoredRouteWaypoint[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    const label = String(row.label ?? '').trim();
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      continue;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      continue;
    }
    const searchLabel = String(row.searchLabel ?? '').trim();
    out.push({
      label,
      lat,
      lon,
      ...(searchLabel ? { searchLabel } : {}),
    });
    if (out.length >= 8) {
      break;
    }
  }
  return out;
}