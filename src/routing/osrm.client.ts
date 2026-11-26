import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type EnvConfig from 'src/types/env-config.type';

export type OsrmLngLat = [number, number];

export type OsrmDrivingRoute = {
  distanceMeters: number;
  durationSec: number;
  /** GeoJSON LineString coordinates `[lng, lat]`. */
  coordinates: OsrmLngLat[];
};

type OsrmApiResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { type?: string; coordinates?: unknown };
  }>;
};

const DEFAULT_OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_TIMEOUT_MS = 25_000;

@Injectable()
export class OsrmClient {
  private readonly log = new Logger(OsrmClient.name);

  constructor(private readonly config: ConfigService<EnvConfig>) {}

  private baseUrl(): string {
    const raw =
      (this.config.get('OSRM_BASE_URL', { infer: true }) as string | undefined)?.trim() ||
      DEFAULT_OSRM_BASE;
    return raw.replace(/\/+$/, '');
  }

  /**
   * Ruta driving con geometría completa (primera / única alternativa).
   */
  async drivingRoute(
    points: ReadonlyArray<{ lat: number; lon: number }>,
  ): Promise<OsrmDrivingRoute> {
    const routes = await this.drivingRouteAlternatives(points);
    return routes[0]!;
  }

  /**
   * Hasta 3 alternativas OSRM con geometría completa.
   * `points` en orden origen → waypoints → destino (`{lat, lon}`).
   */
  async drivingRouteAlternatives(
    points: ReadonlyArray<{ lat: number; lon: number }>,
  ): Promise<OsrmDrivingRoute[]> {
    if (points.length < 2) {
      throw new ServiceUnavailableException('Se requieren al menos origen y destino.');
    }
    const coords = points
      .map((p) => `${Number(p.lon).toFixed(6)},${Number(p.lat).toFixed(6)}`)
      .join(';');
    const url =
      `${this.baseUrl()}/${coords}` +
      `?overview=full&geometries=geojson&steps=false&alternatives=true`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });
    } catch (err: unknown) {
      this.log.warn(
        `OSRM red: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo calcular la ruta (OSRM no disponible).',
      );
    }
    if (!res.ok) {
      throw new ServiceUnavailableException(
        `OSRM respondió ${res.status}; no se pudo calcular la ruta.`,
      );
    }
    const body = (await res.json()) as OsrmApiResponse;
    if (String(body.code ?? '').toUpperCase() !== 'OK' || !body.routes?.length) {
      throw new ServiceUnavailableException(
        'OSRM no encontró ruta entre los puntos indicados.',
      );
    }
    const parsed: OsrmDrivingRoute[] = [];
    for (const route of body.routes) {
      const coordinates = parseLineString(route.geometry?.coordinates);
      if (coordinates.length < 2) {
        continue;
      }
      parsed.push({
        distanceMeters: Number(route.distance) || 0,
        durationSec: Number(route.duration) || 0,
        coordinates,
      });
    }
    if (parsed.length === 0) {
      throw new ServiceUnavailableException(
        'OSRM devolvió geometría inválida.',
      );
    }
    return parsed;
  }
}

function parseLineString(raw: unknown): OsrmLngLat[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: OsrmLngLat[] = [];
  for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length < 2) {
      continue;
    }
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      continue;
    }
    out.push([lng, lat]);
  }
  return out;
}
