/**
 * Distancias de maniobra: OSRM = solo ida; operación logística = siempre ida + vuelta (×2).
 * Fuente única para diesel, desgaste y métricas de km del path de trips/fuel.
 *
 * Verificación: `npm run check:trip-distance`
 */
export type TripDistanceBreakdown = {
  routeDistanceKm: number;
  operationalDistanceKm: number;
  roundTripFactor: number;
  /** Siempre true: las maniobras operan ida+vuelta. */
  isRoundTrip: true;
};

const ROUND_TRIP_FACTOR = 2;

export function resolveTripOperationalDistance(
  routeDistanceKmOneWay: number,
  /** Ignorado: trips/fuel siempre ×2 (compat call sites legacy). */
  _isRoundTrip?: boolean,
): TripDistanceBreakdown {
  const route = Number(routeDistanceKmOneWay);
  if (!Number.isFinite(route) || route <= 0) {
    throw new Error('routeDistanceKm must be a positive finite number');
  }
  return {
    routeDistanceKm: route,
    operationalDistanceKm: route * ROUND_TRIP_FACTOR,
    roundTripFactor: ROUND_TRIP_FACTOR,
    isRoundTrip: true,
  };
}

export function resolveOperationalDistanceKm(
  routeDistanceKmOneWay: number,
  _isRoundTrip?: boolean,
): number {
  return resolveTripOperationalDistance(routeDistanceKmOneWay)
    .operationalDistanceKm;
}

/** Km operativos: siempre route × 2 (ya no se persiste operational_distance_km). */
export function operationalKmFromStoredTrip(
  routeDistanceKm: number | null | undefined,
  /** Ignorado: columna dropeada; se conserva firma por call sites legacy. */
  _operationalDistanceKm?: number | null,
  _isRoundTrip?: boolean,
): number | null {
  if (
    routeDistanceKm != null &&
    Number.isFinite(routeDistanceKm) &&
    routeDistanceKm > 0
  ) {
    return resolveOperationalDistanceKm(routeDistanceKm);
  }
  return null;
}
