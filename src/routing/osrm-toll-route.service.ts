import { Injectable, Logger } from '@nestjs/common';
import {
  colimaEntryViaPoint,
  needsColimaEntryViaRepair,
  stripEastRingAfterColimaEntry,
} from 'src/tolls/route-toll-corridor-repair.util';
import {
  detectTollPlazasAlongRoute,
  type DetectedTollPlaza,
} from 'src/tolls/route-toll-detect.util';
import { TollPlazaCatalogService } from 'src/tolls/toll-plaza-catalog.service';
import {
  tollPlazaCatalogKey,
  tollPlazaCostMxnForAxles,
} from 'src/tolls/toll-plaza-price.util';
import type { TollPlaza } from 'src/tolls/entities/toll-plaza.entity';
import { OsrmClient, type OsrmDrivingRoute } from './osrm.client';

/**
 * Entre alternativas casi igual de cortas, se puede preferir menos casetas.
 * La prioridad absoluta es la distancia (como Google ≈ ruta corta/cuota).
 */
const ALT_DISTANCE_SLACK = 1.03;

export type RouteTollPlazaRow = {
  order: number;
  plazaKey: string;
  plazaKeySource: 'catalog';
  /** Coordenadas `"lat,lng"` (compat map/FE; antes inegiPoint). */
  inegiPoint?: string;
  name: string;
  /** Tramo / sección de la red (catálogo). */
  section?: string | null;
  costMxn: number | null;
  lat?: number;
  lng?: number;
  kmAlongRoute?: number;
};

export type RouteTollsResult = {
  source: 'osrm';
  routePreference: 'driving';
  routeMode: 'osrm';
  /** Ejes usados para la tarifa. */
  vehicleCode: number;
  plazas: RouteTollPlazaRow[];
  tollCount: number;
  totalOneWayMxn: number | null;
  totalRoundTripMxn: number | null;
  attribution: string;
  distanceKm: number | null;
  durationSec: number | null;
};

type RouteWaypointInput = {
  lat: number;
  lon: number;
  label?: string;
  searchLabel?: string;
};

@Injectable()
export class OsrmTollRouteService {
  private readonly log = new Logger(OsrmTollRouteService.name);

  constructor(
    private readonly osrm: OsrmClient,
    private readonly catalog: TollPlazaCatalogService,
  ) {}

  async routeTollsOnTollRoad(
    input: {
      originLat: number;
      originLon: number;
      destinationLat: number;
      destinationLon: number;
      axleCount?: number;
      originSearch?: string;
      destinationSearch?: string;
      excludePlazaKeys?: string[];
      waypoints?: RouteWaypointInput[];
    },
    _companyId?: number,
  ): Promise<RouteTollsResult> {
    const axleCount =
      input.axleCount != null && Number.isFinite(input.axleCount)
        ? Math.round(input.axleCount)
        : 5;

    const points = this.buildPointChain(input);
    const plazasCatalog = await this.catalog.getAll();
    const routes = await this.osrm.drivingRouteAlternatives(points);
    let { route, detected } = pickRouteWithFewestTolls(routes, plazasCatalog);

    // Si OSRM entró por Colima (Acatlán) y luego se fue al anillo oriente,
    // reintenta pasando por Acatlán y recorta el radial Zapotlanejo/periférico
    // cuando el destino queda del lado de Zapopan.
    if (needsColimaEntryViaRepair(detected) && points.length === 2) {
      const via = colimaEntryViaPoint(detected);
      if (via) {
        const repairedRoutes = await this.osrm.drivingRouteAlternatives([
          points[0]!,
          via,
          points[1]!,
        ]);
        const repaired = pickRouteWithFewestTolls(repairedRoutes, plazasCatalog);
        if (repaired.detected.length <= detected.length) {
          route = repaired.route;
          detected = repaired.detected;
        }
      }
    }

    detected = stripEastRingAfterColimaEntry(detected, {
      lat: input.destinationLat,
      lon: input.destinationLon,
    });

    const plazas: RouteTollPlazaRow[] = detected.map((hitPlaza, index) => {
      const cost = tollPlazaCostMxnForAxles(hitPlaza.plaza, axleCount);
      const lat = hitPlaza.plaza.lat;
      const lng = hitPlaza.plaza.lng;
      const section = hitPlaza.plaza.section?.trim() || null;
      return {
        order: index + 1,
        plazaKey: tollPlazaCatalogKey(hitPlaza.plaza.plazaId),
        plazaKeySource: 'catalog',
        inegiPoint: `${lat},${lng}`,
        name: hitPlaza.plaza.name?.trim() || `Plaza ${hitPlaza.plaza.plazaId}`,
        ...(section ? { section } : {}),
        costMxn: cost,
        lat,
        lng,
        kmAlongRoute: hitPlaza.kmAlongRoute,
      };
    });

    const totalOneWay = sumCosts(plazas);
    const distanceKm =
      route.distanceMeters > 0
        ? Math.round((route.distanceMeters / 1000) * 1000) / 1000
        : null;

    const payload: RouteTollsResult = {
      source: 'osrm',
      routePreference: 'driving',
      routeMode: 'osrm',
      vehicleCode: axleCount,
      plazas,
      tollCount: plazas.length,
      totalOneWayMxn: totalOneWay,
      totalRoundTripMxn:
        totalOneWay != null ? Math.round(totalOneWay * 2 * 100) / 100 : null,
      attribution: 'OSRM + catálogo TerminalOps',
      distanceKm,
      durationSec: route.durationSec > 0 ? Math.round(route.durationSec) : null,
    };

    this.log.debug(
      `Ruta casetas: ${plazas.length} plazas, ${distanceKm ?? '?'} km, ejes=${axleCount}`,
    );
    return this.applyExcludedPlazas(payload, input.excludePlazaKeys);
  }

  private buildPointChain(input: {
    originLat: number;
    originLon: number;
    destinationLat: number;
    destinationLon: number;
    waypoints?: RouteWaypointInput[];
  }): Array<{ lat: number; lon: number }> {
    const mids = (input.waypoints ?? [])
      .filter(
        (w) =>
          Number.isFinite(w.lat) &&
          Number.isFinite(w.lon) &&
          Math.abs(w.lat) <= 90 &&
          Math.abs(w.lon) <= 180,
      )
      .map((w) => ({ lat: w.lat, lon: w.lon }));
    return [
      { lat: input.originLat, lon: input.originLon },
      ...mids,
      { lat: input.destinationLat, lon: input.destinationLon },
    ];
  }

  private applyExcludedPlazas(
    base: RouteTollsResult,
    excludePlazaKeys: string[] | undefined,
  ): RouteTollsResult {
    const exclude = new Set(
      (excludePlazaKeys ?? []).map((k) => k.trim()).filter(Boolean),
    );
    if (exclude.size === 0) {
      return base;
    }
    const active = base.plazas.filter((p) => !exclude.has(p.plazaKey));
    const totalOneWay = sumCosts(active);
    return {
      ...base,
      plazas: base.plazas,
      tollCount: active.length,
      totalOneWayMxn: totalOneWay,
      totalRoundTripMxn:
        totalOneWay != null ? Math.round(totalOneWay * 2 * 100) / 100 : null,
    };
  }
}

function sumCosts(plazas: readonly RouteTollPlazaRow[]): number | null {
  let sum = 0;
  let any = false;
  for (const p of plazas) {
    if (p.costMxn == null || !Number.isFinite(p.costMxn) || p.costMxn <= 0) {
      continue;
    }
    sum += p.costMxn;
    any = true;
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

function pickRouteWithFewestTolls(
  routes: readonly OsrmDrivingRoute[],
  catalog: readonly TollPlaza[],
): { route: OsrmDrivingRoute; detected: DetectedTollPlaza[] } {
  const shortest = Math.min(...routes.map((r) => r.distanceMeters || Infinity));
  let best: {
    route: OsrmDrivingRoute;
    detected: DetectedTollPlaza[];
  } | null = null;

  for (const route of routes) {
    if (
      shortest > 0 &&
      Number.isFinite(shortest) &&
      route.distanceMeters > shortest * ALT_DISTANCE_SLACK
    ) {
      continue;
    }
    const detected = detectTollPlazasAlongRoute(route.coordinates, catalog);
    if (
      !best ||
      route.distanceMeters < best.route.distanceMeters ||
      (route.distanceMeters === best.route.distanceMeters &&
        detected.length < best.detected.length)
    ) {
      best = { route, detected };
    }
  }

  if (best) {
    return best;
  }
  const fallback = routes[0]!;
  return {
    route: fallback,
    detected: detectTollPlazasAlongRoute(fallback.coordinates, catalog),
  };
}
