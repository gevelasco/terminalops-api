import { lineString, point } from '@turf/helpers';
import { length } from '@turf/length';
import { nearestPointOnLine } from '@turf/nearest-point-on-line';
import type { TollPlaza } from './entities/toll-plaza.entity';

/** Radio de captura caseta↔ruta (40 m; evita falsos positivos de vías paralelas). */
export const TOLL_PLAZA_ROUTE_TOLERANCE_KM = 0.04;

/** Sentidos/cabinas de la misma plaza física. */
const DIRECTION_PAIR_RADIUS_M = 200;

/** Si dos hits del mismo nombre quedan a ≤ este km a lo largo de la ruta, se fusionan. */
const ALONG_ROUTE_DEDUP_KM = 0.35;

export type DetectedTollPlaza = {
  plaza: TollPlaza;
  /** km desde el origen a lo largo de la línea OSRM. */
  kmAlongRoute: number;
  /** Distancia perpendicular caseta→ruta (km). */
  distanceToRouteKm: number;
};

type LngLat = [number, number];

function bboxOfLine(
  coords: readonly LngLat[],
  padDeg: number,
): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return {
    minLng: minLng - padDeg,
    minLat: minLat - padDeg,
    maxLng: maxLng + padDeg,
    maxLat: maxLat + padDeg,
  };
}

/**
 * Casetas a ≤ `toleranceKm` del LineString OSRM `[lng,lat]…`,
 * ordenadas desde el origen (km 0).
 */
export function detectTollPlazasAlongRoute(
  routeLngLat: readonly LngLat[],
  plazas: readonly TollPlaza[],
  toleranceKm = TOLL_PLAZA_ROUTE_TOLERANCE_KM,
): DetectedTollPlaza[] {
  if (routeLngLat.length < 2 || plazas.length === 0) {
    return [];
  }
  // ~0.001° ≈ 111 m; padding para no perder casetas en el borde del bbox.
  const padDeg = Math.max(0.002, toleranceKm / 50);
  const box = bboxOfLine(routeLngLat, padDeg);
  const candidates = plazas.filter(
    (p) =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng) &&
      p.lng >= box.minLng &&
      p.lng <= box.maxLng &&
      p.lat >= box.minLat &&
      p.lat <= box.maxLat,
  );
  if (candidates.length === 0) {
    return [];
  }

  const line = lineString(routeLngLat as LngLat[]);
  const routeLenKm = length(line, { units: 'kilometers' });
  const hits: DetectedTollPlaza[] = [];

  for (const plaza of candidates) {
    const snapped = nearestPointOnLine(line, point([plaza.lng, plaza.lat]), {
      units: 'kilometers',
    });
    const distKm = Number(snapped.properties?.dist);
    const locKm = Number(snapped.properties?.location);
    if (!Number.isFinite(distKm) || distKm > toleranceKm) {
      continue;
    }
    if (!Number.isFinite(locKm)) {
      continue;
    }
    if (locKm < -0.05 || locKm > routeLenKm + 0.05) {
      continue;
    }
    hits.push({
      plaza,
      kmAlongRoute: Math.round(locKm * 1000) / 1000,
      distanceToRouteKm: Math.round(distKm * 100000) / 100000,
    });
  }

  hits.sort(
    (a, b) =>
      a.kmAlongRoute - b.kmAlongRoute ||
      a.distanceToRouteKm - b.distanceToRouteKm ||
      a.plaza.plazaId - b.plaza.plazaId,
  );

  return collapseDirectionPairs(hits);
}

function collapseDirectionPairs(
  hits: readonly DetectedTollPlaza[],
): DetectedTollPlaza[] {
  const seenIds = new Set<number>();
  const unique: DetectedTollPlaza[] = [];
  for (const hit of hits) {
    if (seenIds.has(hit.plaza.plazaId)) {
      continue;
    }
    const duplicate = unique.some((kept) => isSamePhysicalPlaza(kept, hit));
    if (duplicate) {
      continue;
    }
    seenIds.add(hit.plaza.plazaId);
    unique.push(hit);
  }
  return unique;
}

function isSamePhysicalPlaza(
  kept: DetectedTollPlaza,
  hit: DetectedTollPlaza,
): boolean {
  const sameName =
    normalizeName(kept.plaza.name) === normalizeName(hit.plaza.name) &&
    normalizeName(kept.plaza.name).length > 0;
  const sameSection =
    !!normalizeName(kept.plaza.section) &&
    normalizeName(kept.plaza.section) === normalizeName(hit.plaza.section);
  const nearMeters =
    haversineMeters(kept.plaza, hit.plaza) <= DIRECTION_PAIR_RADIUS_M;
  const nearAlong =
    Math.abs(kept.kmAlongRoute - hit.kmAlongRoute) <= ALONG_ROUTE_DEDUP_KM;

  if (sameName && (nearMeters || nearAlong)) {
    return true;
  }
  if (sameSection && (nearMeters || nearAlong)) {
    return true;
  }
  return false;
}

function normalizeName(value: string | undefined | null): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
