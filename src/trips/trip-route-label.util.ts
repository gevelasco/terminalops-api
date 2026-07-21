/** Partes postales usadas para armar labels de origen/destino (no se persiste el string). */
export type TripRouteEndpointParts = {
  locality?: string | null;
  cityMunicipality?: string | null;
  postalCode?: string | null;
};

/** Arma label de un extremo de ruta: locality · cityMunicipality · CP. */
export function buildTripRouteEndpointLabel(
  parts: TripRouteEndpointParts,
): string {
  const locality = (parts.locality ?? '').trim();
  const city = (parts.cityMunicipality ?? '').trim();
  const cp = (parts.postalCode ?? '').trim();
  const segments = [locality, city, cp].filter((s) => s.length > 0);
  return segments.length > 0 ? segments.join(' · ') : '—';
}

/** Origin/destination computed para respuesta JSON (compat FE). */
export function buildTripOriginLabel(trip: {
  originLocality?: string | null;
  originCityMunicipality?: string | null;
  originPostalCode?: string | null;
}): string {
  return buildTripRouteEndpointLabel({
    locality: trip.originLocality,
    cityMunicipality: trip.originCityMunicipality,
    postalCode: trip.originPostalCode,
  });
}

export function buildTripDestinationLabel(trip: {
  destinationLocality?: string | null;
  destinationCityMunicipality?: string | null;
  destinationPostalCode?: string | null;
}): string {
  return buildTripRouteEndpointLabel({
    locality: trip.destinationLocality,
    cityMunicipality: trip.destinationCityMunicipality,
    postalCode: trip.destinationPostalCode,
  });
}

export function buildTripRouteLabel(trip: {
  originLocality?: string | null;
  originCityMunicipality?: string | null;
  originPostalCode?: string | null;
  destinationLocality?: string | null;
  destinationCityMunicipality?: string | null;
  destinationPostalCode?: string | null;
}): string {
  return `${buildTripOriginLabel(trip)} → ${buildTripDestinationLabel(trip)}`;
}
