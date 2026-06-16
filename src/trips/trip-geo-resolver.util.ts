import type { OperationalCenter } from 'src/operational-centers/entities/operational-center.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import type {
  TripMapGeoPointDto,
  TripMapGeoPointSource,
  TripMapGeoQuality,
  TripMapItemDto,
  TripMapStatus,
} from './dto/trip-map-item.dto';

const MAP_STATUSES = new Set<TripMapStatus>(['scheduled', 'in_transit']);

export function isTripMapStatus(status: string): status is TripMapStatus {
  return MAP_STATUSES.has(status as TripMapStatus);
}

function parseCoord(value: string | number | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isCompactRouteToken(value: string): boolean {
  return value.length > 0 && !value.includes(',') && !/CP\s/i.test(value);
}

function routeEndpointLabel(
  primary: string | null | undefined,
  locality: string | null | undefined,
  cityMunicipality: string | null | undefined,
): string {
  const primaryTrimmed = (primary ?? '').trim();
  const localityTrimmed = (locality ?? '').trim();
  const cityTrimmed = (cityMunicipality ?? '').trim();

  if (primaryTrimmed && !isCompactRouteToken(primaryTrimmed)) {
    return primaryTrimmed;
  }

  const parts = [primaryTrimmed, localityTrimmed, cityTrimmed].filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function pointFromCoords(
  lat: number | null,
  lng: number | null,
  label: string,
  source: TripMapGeoPointSource,
): TripMapGeoPointDto {
  return { lat, lng, label, source };
}

function isPointResolved(point: TripMapGeoPointDto): boolean {
  return point.lat != null && point.lng != null;
}

export function computeGeoQuality(
  origin: TripMapGeoPointDto,
  destination: TripMapGeoPointDto,
): TripMapGeoQuality {
  const originOk = isPointResolved(origin);
  const destOk = isPointResolved(destination);
  if (originOk && destOk) {
    return 'resolved';
  }
  if (originOk || destOk) {
    return 'partial';
  }
  return 'unresolved';
}

function findCenterByOriginHints(
  centers: readonly OperationalCenter[],
  postalCode: string | null | undefined,
  locality: string | null | undefined,
): OperationalCenter | null {
  const cp = (postalCode ?? '').trim();
  const loc = normalizeToken(locality);
  if (!cp || !loc) {
    return null;
  }
  const matches = centers.filter((c) => {
    const cCp = (c.postalCode ?? '').trim();
    const cLoc = normalizeToken(c.locality);
    return cCp === cp && cLoc === loc;
  });
  if (matches.length === 1) {
    return matches[0];
  }
  return null;
}

export type TripGeoResolverContext = {
  defaultCenter: OperationalCenter;
  operationalCenters: readonly OperationalCenter[];
  matchedRateDestination?: {
    destinationLatitude?: string | null;
    destinationLongitude?: string | null;
    originLatitude?: string | null;
    originLongitude?: string | null;
    postalCode?: string;
    locality?: string;
    cityMunicipality?: string;
  } | null;
};

export function resolveDestinationPoint(
  trip: Trip,
  ctx: TripGeoResolverContext,
): TripMapGeoPointDto {
  const label = routeEndpointLabel(
    trip.destination,
    trip.destinationLocality,
    trip.destinationCityMunicipality,
  );
  const rate = trip.destinationRate;

  const rateLat = parseCoord(rate?.destinationLatitude);
  const rateLng = parseCoord(rate?.destinationLongitude);
  if (rateLat != null && rateLng != null) {
    return pointFromCoords(rateLat, rateLng, label, 'destination_rate');
  }

  const delivery = trip.client?.delivery;
  const deliveryLat = parseCoord(delivery?.latitude);
  const deliveryLng = parseCoord(delivery?.longitude);
  if (deliveryLat != null && deliveryLng != null) {
    return pointFromCoords(deliveryLat, deliveryLng, label, 'client_delivery');
  }

  const matched = ctx.matchedRateDestination;
  if (matched) {
    const mLat = parseCoord(matched.destinationLatitude);
    const mLng = parseCoord(matched.destinationLongitude);
    if (mLat != null && mLng != null) {
      return pointFromCoords(mLat, mLng, label, 'fallback');
    }
  }

  return pointFromCoords(null, null, label, 'unresolved');
}

export function resolveOriginPoint(
  trip: Trip,
  ctx: TripGeoResolverContext,
): TripMapGeoPointDto {
  const label = routeEndpointLabel(
    trip.origin,
    trip.originLocality,
    trip.originCityMunicipality,
  );
  const rate = trip.destinationRate;

  const rateLat = parseCoord(rate?.originLatitude);
  const rateLng = parseCoord(rate?.originLongitude);
  if (rateLat != null && rateLng != null) {
    return pointFromCoords(rateLat, rateLng, label, 'destination_rate');
  }

  const inferred = findCenterByOriginHints(
    ctx.operationalCenters,
    trip.originPostalCode,
    trip.originLocality,
  );
  if (inferred) {
    const lat = parseCoord(inferred.latitude);
    const lng = parseCoord(inferred.longitude);
    if (lat != null && lng != null) {
      return pointFromCoords(lat, lng, label, 'operational_center');
    }
  }

  const defaultLat = parseCoord(ctx.defaultCenter.latitude);
  const defaultLng = parseCoord(ctx.defaultCenter.longitude);
  if (defaultLat != null && defaultLng != null) {
    return pointFromCoords(defaultLat, defaultLng, label, 'fallback');
  }

  return pointFromCoords(null, null, label, 'unresolved');
}

export function mapTripToMapItem(
  trip: Trip,
  ctx: TripGeoResolverContext,
): TripMapItemDto {
  const origin = resolveOriginPoint(trip, ctx);
  const destination = resolveDestinationPoint(trip, ctx);
  return {
    id: String(trip.id),
    maneuverCode: trip.maneuverCode,
    status: trip.status as TripMapStatus,
    origin,
    destination,
    geoQuality: computeGeoQuality(origin, destination),
  };
}

export function buildTripsMapMeta(items: readonly TripMapItemDto[]) {
  let resolved = 0;
  let partial = 0;
  let unresolved = 0;
  for (const item of items) {
    switch (item.geoQuality) {
      case 'resolved':
        resolved += 1;
        break;
      case 'partial':
        partial += 1;
        break;
      case 'unresolved':
        unresolved += 1;
        break;
    }
  }
  return {
    total: items.length,
    resolved,
    partial,
    unresolved,
  };
}
