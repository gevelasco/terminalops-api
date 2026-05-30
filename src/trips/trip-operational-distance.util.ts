/**
 * Distancias de maniobra: OSRM = solo ida; operación logística = ida + vuelta (default).
 * Fuente única para diesel, desgaste y métricas de km.
 *
 * `isRoundTrip !== false` — el default explícito es ida+vuelta; no omitir el flag en DTOs.
 * Verificación: `npm run check:trip-distance`
 */
export type TripDistanceBreakdown = {
  routeDistanceKm: number;
  operationalDistanceKm: number;
  roundTripFactor: number;
  isRoundTrip: boolean;
};

export function resolveTripOperationalDistance(
  routeDistanceKmOneWay: number,
  isRoundTrip: boolean | undefined = true,
): TripDistanceBreakdown {
  const route = Number(routeDistanceKmOneWay);
  if (!Number.isFinite(route) || route <= 0) {
    throw new Error('routeDistanceKm must be a positive finite number');
  }
  const roundTrip = isRoundTrip !== false;
  const roundTripFactor = roundTrip ? 2 : 1;
  return {
    routeDistanceKm: route,
    operationalDistanceKm: route * roundTripFactor,
    roundTripFactor,
    isRoundTrip: roundTrip,
  };
}

export function resolveOperationalDistanceKm(
  routeDistanceKmOneWay: number,
  isRoundTrip: boolean | undefined = true,
): number {
  return resolveTripOperationalDistance(routeDistanceKmOneWay, isRoundTrip)
    .operationalDistanceKm;
}

/** Km operativos persistidos o estimación legacy (solo ida guardada → ×2). */
export function operationalKmFromStoredTrip(
  routeDistanceKm: number | null | undefined,
  operationalDistanceKm: number | null | undefined,
  isRoundTrip: boolean | undefined = true,
): number | null {
  if (
    operationalDistanceKm != null &&
    Number.isFinite(operationalDistanceKm) &&
    operationalDistanceKm > 0
  ) {
    return operationalDistanceKm;
  }
  if (
    routeDistanceKm != null &&
    Number.isFinite(routeDistanceKm) &&
    routeDistanceKm > 0
  ) {
    return resolveOperationalDistanceKm(routeDistanceKm, isRoundTrip);
  }
  return null;
}
