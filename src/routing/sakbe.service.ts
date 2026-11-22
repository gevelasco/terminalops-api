import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import EnvConfig from 'src/types/env-config.type';
import {
  sakbeTollPlazaTotalMxn,
  sakbeTollPlazasFromRouteDetail,
  type SakbeTollPlazaRow,
} from './sakbe-route-tolls.parser';
import { sakbeVehicleCodeFromAxleCount } from './sakbe-vehicle.util';
import { mergeSakbeTollPlazasLegs } from './sakbe-route-merge.util';
import { TollPlazaAliasService } from './toll-plaza-alias.service';
import {
  isSakbeSearchLengthError,
  sakbeBuscadestinoCandidates,
  SAKBE_BUSCADESTINO_MAX_CHARS,
  sakbeStripAccents,
} from './sakbe-buscadestino-search.util';

const SAKBE_BASE = 'https://gaia.inegi.org.mx/sakbe_v3.1';
const CACHE_TTL_MS = 20 * 60 * 1000;
const LINE_REF_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SAKBE_FETCH_TIMEOUT_MS = 18_000;
/** `detalle_c` en rutas largas puede tardar varios minutos en INEGI; sin abort. */
const SAKBE_DETALLE_TIMEOUT_MS = 0;
const SAKBE_LEG_CONCURRENCY = 2;
const BUSCALINEA_ESCALAS = [
  50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000,
] as const;
/** Escalas más probables en corredores cuota (se consultan en paralelo primero). */
const BUSCALINEA_FAST_ESCALAS = [250_000, 1_000_000, 500_000, 2_500_000] as const;

type SakbeLineRef = {
  id_routing_net: number | string;
  source: number | string;
  target: number | string;
};

type SakbeEnvelope<T> = {
  data?: T;
  meta?: { fuente?: string };
  response?: { success?: boolean; message?: string };
};

type CachedRouteTolls = {
  routeMode: 'line' | 'destination';
  vehicleCode: number;
  plazas: SakbeTollPlazaRow[];
  attribution: string;
};

type CacheEntry = {
  expiresAt: number;
  payload: CachedRouteTolls;
};

type FullRouteCacheEntry = {
  expiresAt: number;
  payload: RouteTollsResult;
};

type BuscadestinoCacheEntry = {
  expiresAt: number;
  id: number | string;
};

type SakbeRoutePoint = {
  lat: number;
  lon: number;
  search?: string;
};

type RouteWaypointInput = {
  lat: number;
  lon: number;
  label: string;
  searchLabel?: string;
};

export type RouteTollsResult = {
  source: 'inegi';
  routePreference: 'cuota';
  routeMode: 'line' | 'destination';
  vehicleCode: number;
  plazas: SakbeTollPlazaRow[];
  tollCount: number;
  totalOneWayMxn: number | null;
  totalRoundTripMxn: number | null;
  attribution: string;
};

type LineRefCacheEntry = {
  expiresAt: number;
  line: SakbeLineRef;
};

@Injectable()
export class SakbeService {
  private readonly log = new Logger(SakbeService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly fullRouteCache = new Map<string, FullRouteCacheEntry>();
  private readonly lineRefCache = new Map<string, LineRefCacheEntry>();
  private readonly buscadestinoCache = new Map<string, BuscadestinoCacheEntry>();

  constructor(
    private readonly config: ConfigService<EnvConfig>,
    private readonly tollPlazaAliases: TollPlazaAliasService,
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
    companyId?: number,
  ): Promise<RouteTollsResult> {
    const key = this.config.get('INEGI_SAKBE_KEY', { infer: true })?.trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'Consulta de casetas no configurada (falta INEGI_SAKBE_KEY).',
      );
    }
    const vehicleCode = sakbeVehicleCodeFromAxleCount(input.axleCount);
    const fullRouteKey = this.fullRouteInputCacheKey(input, vehicleCode);
    const fullHit = this.fullRouteCache.get(fullRouteKey);
    if (fullHit && fullHit.expiresAt > Date.now()) {
      return this.applyExcludedPlazas(fullHit.payload, input.excludePlazaKeys);
    }

    const waypoints = this.normalizeWaypoints(input.waypoints);
    const chain = this.buildRoutePointChain(input, waypoints);
    const legs = this.buildRouteLegs(chain);

    const legResults = await this.mapWithConcurrency(
      legs,
      SAKBE_LEG_CONCURRENCY,
      ([from, to]) => this.fetchSegmentTolls(from, to, vehicleCode, key),
    );
  const mergedPlazas = mergeSakbeTollPlazasLegs(
    legResults.map((r) => r.plazas),
  );
  const routeMode = legResults.some((r) => r.routeMode === 'destination')
    ? 'destination'
    : 'line';
  const attribution =
    legResults.map((r) => r.attribution).find((a) => a.trim().length > 0) ??
    'INEGI, SAKBÉ Sistema de Ruteo de México';

    let plazas = mergedPlazas;
    plazas = await this.tollPlazaAliases.resolvePlazaNames(
      companyId != null && Number.isFinite(companyId) ? companyId : undefined,
      plazas,
    );
    const totalBase = sakbeTollPlazaTotalMxn(mergedPlazas, []);
    const cachedResult: RouteTollsResult = {
      source: 'inegi',
      routePreference: 'cuota',
      routeMode,
      vehicleCode,
      plazas,
      tollCount: plazas.length,
      totalOneWayMxn: totalBase,
      totalRoundTripMxn:
        totalBase != null ? Math.round(totalBase * 2 * 100) / 100 : null,
      attribution,
    };
    this.fullRouteCache.set(fullRouteKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload: cachedResult,
    });
    return this.applyExcludedPlazas(cachedResult, input.excludePlazaKeys);
  }

  private applyExcludedPlazas(
    base: RouteTollsResult,
    excludePlazaKeys: string[] | undefined,
  ): RouteTollsResult {
    const exclude = (excludePlazaKeys ?? [])
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    if (exclude.length === 0) {
      return base;
    }
    const active = base.plazas.filter((p) => !exclude.includes(p.plazaKey));
    const totalOneWay = sakbeTollPlazaTotalMxn(base.plazas, exclude);
    return {
      ...base,
      plazas: base.plazas,
      tollCount: active.length,
      totalOneWayMxn: totalOneWay,
      totalRoundTripMxn:
        totalOneWay != null ? Math.round(totalOneWay * 2 * 100) / 100 : null,
    };
  }

  private fullRouteInputCacheKey(
    input: {
      originLat: number;
      originLon: number;
      destinationLat: number;
      destinationLon: number;
      originSearch?: string;
      destinationSearch?: string;
      excludePlazaKeys?: string[];
      waypoints?: RouteWaypointInput[];
    },
    vehicleCode: number,
  ): string {
    const wp = (input.waypoints ?? [])
      .map(
        (w) =>
          `${w.lat.toFixed(4)},${w.lon.toFixed(4)},${(w.searchLabel ?? w.label).trim().toLowerCase()}`,
      )
      .join(';');
    return [
      'v3',
      input.originLat.toFixed(4),
      input.originLon.toFixed(4),
      input.destinationLat.toFixed(4),
      input.destinationLon.toFixed(4),
      (input.originSearch ?? '').trim().toLowerCase(),
      (input.destinationSearch ?? '').trim().toLowerCase(),
      vehicleCode,
      wp,
    ].join('|');
  }

  private async mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    const workerCount = Math.max(1, Math.min(limit, items.length));
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await fn(items[index]!);
      }
    });
    await Promise.all(workers);
    return results;
  }

  private normalizeWaypoints(
    raw: RouteWaypointInput[] | undefined,
  ): RouteWaypointInput[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    const out: RouteWaypointInput[] = [];
    for (const wp of raw) {
      const lat = Number(wp?.lat);
      const lon = Number(wp?.lon);
      const label = String(wp?.label ?? '').trim();
      if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }
      const rawSearch = String(wp?.searchLabel ?? '').trim() || label;
      const searchLabel = this.sanitizeSakbeSearchLabel(rawSearch);
      out.push({
        lat,
        lon,
        label,
        searchLabel: searchLabel || label.slice(0, SAKBE_BUSCADESTINO_MAX_CHARS),
      });
      if (out.length >= 8) {
        break;
      }
    }
    return out;
  }

  private buildRoutePointChain(
    input: {
      originLat: number;
      originLon: number;
      destinationLat: number;
      destinationLon: number;
      originSearch?: string;
      destinationSearch?: string;
    },
    waypoints: RouteWaypointInput[],
  ): SakbeRoutePoint[] {
    const points: SakbeRoutePoint[] = [
      {
        lat: input.originLat,
        lon: input.originLon,
        search:
          this.sanitizeSakbeSearchLabel(input.originSearch ?? '') || undefined,
      },
    ];
    for (const wp of waypoints) {
      points.push({
        lat: wp.lat,
        lon: wp.lon,
        search: (wp.searchLabel ?? wp.label).trim() || undefined,
      });
    }
    points.push({
      lat: input.destinationLat,
      lon: input.destinationLon,
      search:
        this.sanitizeSakbeSearchLabel(input.destinationSearch ?? '') || undefined,
    });
    return points;
  }

  private buildRouteLegs(
    points: readonly SakbeRoutePoint[],
  ): [SakbeRoutePoint, SakbeRoutePoint][] {
    const legs: [SakbeRoutePoint, SakbeRoutePoint][] = [];
    for (let i = 0; i < points.length - 1; i++) {
      legs.push([points[i]!, points[i + 1]!]);
    }
    return legs;
  }

  private segmentCacheKey(
    from: SakbeRoutePoint,
    to: SakbeRoutePoint,
    vehicleCode: number,
  ): string {
    return [
      'v3',
      from.lat.toFixed(4),
      from.lon.toFixed(4),
      to.lat.toFixed(4),
      to.lon.toFixed(4),
      vehicleCode,
      (from.search ?? '').trim().toLowerCase(),
      (to.search ?? '').trim().toLowerCase(),
    ].join('|');
  }

  private async fetchSegmentTolls(
    from: SakbeRoutePoint,
    to: SakbeRoutePoint,
    vehicleCode: number,
    apiKey: string,
  ): Promise<CachedRouteTolls> {
    const cacheKey = this.segmentCacheKey(from, to, vehicleCode);
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.payload;
    }

    const { routeParams, routeMode } = await this.resolveCuotaRouteParams(
      {
        originLat: from.lat,
        originLon: from.lon,
        destinationLat: to.lat,
        destinationLon: to.lon,
        originSearch: from.search,
        destinationSearch: to.search,
      },
      apiKey,
      vehicleCode,
    );

    const detail = await this.fetchRouteDetailCuota(routeParams);

    const plazas = sakbeTollPlazasFromRouteDetail(
      Array.isArray(detail.data) ? (detail.data as Record<string, unknown>[]) : [],
    );
    const cached: CachedRouteTolls = {
      routeMode,
      vehicleCode,
      plazas,
      attribution:
        String(detail.meta?.fuente ?? '').trim() ||
        'INEGI, SAKBÉ Sistema de Ruteo de México',
    };
    this.cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload: cached,
    });
    return cached;
  }

  private async resolveCuotaRouteParams(
    input: {
      originLat: number;
      originLon: number;
      destinationLat: number;
      destinationLon: number;
      originSearch?: string;
      destinationSearch?: string;
    },
    key: string,
    vehicleCode: number,
  ): Promise<{
    routeParams: Record<string, string | number>;
    routeMode: 'line' | 'destination';
  }> {
    const base = {
      v: vehicleCode,
      type: 'json' as const,
      proj: 'GRS80' as const,
      key,
    };

    const originSearch = this.sanitizeSakbeSearchLabel(input.originSearch ?? '');
    const destinationSearch = this.sanitizeSakbeSearchLabel(input.destinationSearch ?? '');

    const [destMode, lineMode] = await Promise.all([
      this.tryResolveDestinationMode(base, originSearch, destinationSearch, key),
      this.tryResolveLineMode(base, input, key),
    ]);
    // `line` ancla en las coordenadas reales (buscalinea); `destination` usa buscadestino
    // y puede omitir casetas cercanas al origen (p. ej. Cuyutlán desde Manzanillo).
    if (lineMode) {
      return lineMode;
    }
    if (destMode) {
      return destMode;
    }

    throw new ServiceUnavailableException(
      'No se pudo resolver la ruta en INEGI (SAKBÉ). Confirma localidad y municipio o usa coordenadas con vialidad cercana.',
    );
  }

  private tryResolveDestinationMode(
    base: Record<string, string | number>,
    originSearch: string,
    destinationSearch: string,
    key: string,
  ): Promise<{
    routeParams: Record<string, string | number>;
    routeMode: 'destination';
  } | null> {
    if (!originSearch || !destinationSearch) {
      return Promise.resolve(null);
    }
    return Promise.all([
      this.buscadestinoResolve(originSearch, key),
      this.buscadestinoResolve(destinationSearch, key),
    ]).then(([destI, destF]) => {
      if (destI == null || destF == null) {
        return null;
      }
      return {
        routeMode: 'destination' as const,
        routeParams: {
          ...base,
          dest_i: destI,
          dest_f: destF,
        },
      };
    });
  }

  private async tryResolveLineMode(
    base: Record<string, string | number>,
    input: {
      originLat: number;
      originLon: number;
      destinationLat: number;
      destinationLon: number;
    },
    key: string,
  ): Promise<{
    routeParams: Record<string, string | number>;
    routeMode: 'line';
  } | null> {
    const [originLine, destLine] = await Promise.all([
      this.nearestLine(input.originLon, input.originLat, key),
      this.nearestLine(input.destinationLon, input.destinationLat, key),
    ]);
    if (!originLine || !destLine) {
      return null;
    }
    return {
      routeMode: 'line',
      routeParams: {
        ...base,
        id_i: originLine.id_routing_net,
        source_i: originLine.source,
        target_i: originLine.target,
        id_f: destLine.id_routing_net,
        source_f: destLine.source,
        target_f: destLine.target,
      },
    };
  }

  private pickBuscadestinoId(
    buscar: string,
    rows: ReadonlyArray<{ id_dest?: number | string; nombre?: string }>,
  ): number | string | null {
    if (!rows.length) {
      return null;
    }
    const terms = sakbeStripAccents(buscar)
      .toLowerCase()
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 1);
    let bestId: number | string | null = null;
    let bestScore = 0;
    for (const row of rows) {
      const id = row.id_dest;
      if (id == null || id === '') {
        continue;
      }
      const name = sakbeStripAccents(String(row.nombre ?? '')).toLowerCase();
      const score = terms.reduce(
        (acc, term) => (name.includes(term) ? acc + 1 : acc),
        0,
      );
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    if (bestId != null) {
      return bestId;
    }
    const first = rows[0]?.id_dest;
    return first == null || first === '' ? null : first;
  }

  private async fetchRouteDetailCuota(
    routeParams: Record<string, string | number>,
  ): Promise<SakbeEnvelope<unknown[]>> {
    return this.postSakbe<SakbeEnvelope<unknown[]>>('detalle_c', routeParams, {
      timeoutMs: SAKBE_DETALLE_TIMEOUT_MS,
    });
  }

  private async buscadestinoResolve(
    buscar: string,
    key: string,
  ): Promise<number | string | null> {
    const candidates = sakbeBuscadestinoCandidates(buscar);
    if (candidates.length === 0) {
      return null;
    }
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      const norm = candidate.toLowerCase();
      const hit = this.buscadestinoCache.get(norm);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.id;
      }
      const id = await this.buscadestinoFirst(candidate, key, i < candidates.length - 1);
      if (id != null) {
        this.buscadestinoCache.set(norm, {
          expiresAt: Date.now() + LINE_REF_CACHE_TTL_MS,
          id,
        });
        return id;
      }
    }
    return null;
  }

  private lineRefCacheKey(lon: number, lat: number): string {
    return `${lon.toFixed(4)},${lat.toFixed(4)}`;
  }

  private parseBuscalineaRow(
    data: SakbeLineRef | SakbeLineRef[] | undefined,
  ): SakbeLineRef | null {
    const row = Array.isArray(data) ? data[0] : data;
    if (
      row &&
      row.id_routing_net != null &&
      row.source != null &&
      row.target != null
    ) {
      return row;
    }
    return null;
  }

  private firstBuscalineaHit(
    lon: number,
    lat: number,
    key: string,
    scales: readonly number[],
  ): Promise<SakbeLineRef | null> {
    if (scales.length === 0) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      let remaining = scales.length;
      let settled = false;
      const tryFinish = (row: SakbeLineRef | null): void => {
        if (settled) {
          return;
        }
        if (row) {
          settled = true;
          resolve(row);
          return;
        }
        remaining -= 1;
        if (remaining === 0) {
          settled = true;
          resolve(null);
        }
      };
      for (const escala of scales) {
        void this.buscalineaAtScale(lon, lat, escala, key)
          .then((hit) => tryFinish(hit))
          .catch(() => tryFinish(null));
      }
    });
  }

  private async buscalineaAtScale(
    lon: number,
    lat: number,
    escala: number,
    key: string,
  ): Promise<SakbeLineRef | null> {
    const res = await this.postSakbe<SakbeEnvelope<SakbeLineRef | SakbeLineRef[]>>(
      'buscalinea',
      {
        type: 'json',
        escala,
        x: lon,
        y: lat,
        proj: 'GRS80',
        key,
      },
      { requireData: false },
    );
    return this.parseBuscalineaRow(res.data);
  }

  private rememberLineRef(lon: number, lat: number, line: SakbeLineRef): void {
    this.lineRefCache.set(this.lineRefCacheKey(lon, lat), {
      expiresAt: Date.now() + LINE_REF_CACHE_TTL_MS,
      line,
    });
  }

  private async nearestLine(
    lon: number,
    lat: number,
    key: string,
  ): Promise<SakbeLineRef | null> {
    const cacheKey = this.lineRefCacheKey(lon, lat);
    const hit = this.lineRefCache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.line;
    }

    let row = await this.firstBuscalineaHit(lon, lat, key, BUSCALINEA_FAST_ESCALAS);
    if (!row) {
      row = await this.buscalineaAtScale(lon, lat, 1_000_000, key);
    }
    if (row) {
      this.rememberLineRef(lon, lat, row);
      return row;
    }
    this.log.debug('SAKBE buscalinea sin línea tras escalas', { lon, lat });
    return null;
  }

  private sanitizeSakbeSearchLabel(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      return '';
    }
    const candidates = sakbeBuscadestinoCandidates(trimmed);
    return candidates[0] ?? trimmed.slice(0, SAKBE_BUSCADESTINO_MAX_CHARS).trim();
  }

  private async buscadestinoFirst(
    buscar: string,
    key: string,
    quiet = false,
  ): Promise<number | string | null> {
    const q = sakbeStripAccents(buscar).trim();
    if (!q || q.length > SAKBE_BUSCADESTINO_MAX_CHARS) {
      if (q.length > SAKBE_BUSCADESTINO_MAX_CHARS && !quiet) {
        this.log.warn('SAKBE buscar omitido: supera límite', {
          len: q.length,
          max: SAKBE_BUSCADESTINO_MAX_CHARS,
        });
      }
      return null;
    }
    const res = await this.postSakbe<
      SakbeEnvelope<Array<{ id_dest?: number | string; nombre?: string }>>
    >(
      'buscadestino',
      {
        buscar: q,
        type: 'json',
        num: 8,
        key,
      },
      { requireData: false },
    );
  const success = res.response?.success !== false;
  if (!success) {
    const msg = String(res.response?.message ?? '').trim();
    if (!quiet && msg && !isSakbeSearchLengthError(msg)) {
      this.log.warn('SAKBE buscadestino rechazado', { buscar: q, msg });
    }
    return null;
  }
    const rows = Array.isArray(res.data) ? res.data : [];
    const id = this.pickBuscadestinoId(q, rows);
    if (id == null) {
      if (!quiet) {
        this.log.warn('SAKBE buscadestino vacío', { buscar: q });
      }
      return null;
    }
    return id;
  }

  private async postSakbe<T extends SakbeEnvelope<unknown>>(
    method: string,
    params: Record<string, string | number>,
    options?: { requireData?: boolean; timeoutMs?: number },
  ): Promise<T> {
    const requireData = options?.requireData !== false;
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      body.set(k, String(v));
    }
    const url = `${SAKBE_BASE}/${method}`;
    let response: Response;
    const timeoutMs =
      options?.timeoutMs ??
      (method === 'detalle_c' ? SAKBE_DETALLE_TIMEOUT_MS : SAKBE_FETCH_TIMEOUT_MS);
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timer =
      controller != null
        ? setTimeout(() => controller.abort(), timeoutMs)
        : undefined;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        ...(controller ? { signal: controller.signal } : {}),
      });
    } catch (err) {
      if (timer != null) {
        clearTimeout(timer);
      }
      this.log.warn('SAKBE red error', { method, err });
      throw new ServiceUnavailableException(
        'El servicio de ruteo INEGI no está disponible.',
      );
    }
    if (timer != null) {
      clearTimeout(timer);
    }
    const text = await response.text();
    if (!response.ok) {
      this.log.warn('SAKBE HTTP error', { method, status: response.status });
      throw new ServiceUnavailableException(
        'El servicio de ruteo INEGI respondió con error.',
      );
    }
    let parsed: T;
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      this.log.warn('SAKBE no JSON', { method, sample: text.slice(0, 200) });
      throw new ServiceUnavailableException(
        'Respuesta inválida del servicio INEGI.',
      );
    }
    const ok = parsed.response?.success !== false;
    if (!ok && requireData) {
      const detail = String(parsed.response?.message ?? '').trim();
      if (isSakbeSearchLengthError(detail)) {
        this.log.warn('SAKBE rechazó longitud de búsqueda (sin 503)', { method });
        return parsed;
      }
      throw new ServiceUnavailableException(
        detail || 'El servicio INEGI no devolvió datos para esta consulta.',
      );
    }
    return parsed;
  }
}