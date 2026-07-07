import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FUEL_TYPE_DIESEL,
  FuelPrice,
} from './entities/fuel-price.entity';
import { FUEL_PRICE_DEFAULTS } from './fuel-price.config';
import { fetchDieselFromExternalSources } from './fuel-price-external.providers';
import type {
  CompanyDieselPriceInput,
  CompanyDieselPriceSnapshot,
} from './company-diesel-price.types';
import type EnvConfig from 'src/types/env-config.type';

export type CachedFuelPrice = {
  pricePerLiter: number;
  source: string;
  createdAt: Date;
};

type MemoryFuelCache = {
  pricePerLiter: number;
  source: string;
  cachedAt: Date;
};

@Injectable()
export class FuelPriceService {
  private readonly logger = new Logger(FuelPriceService.name);
  private memoryCache: MemoryFuelCache | null = null;
  /** Evita refresh concurrentes (misma promesa para todas las esperas). */
  private refreshInFlight: Promise<number> | null = null;
  private isRefreshing = false;

  constructor(
    @InjectRepository(FuelPrice)
    private readonly fuelPricesRepo: Repository<FuelPrice>,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  /** Indica si hay un refresh externo en curso (observabilidad / tests). */
  get refreshing(): boolean {
    return this.isRefreshing;
  }

  /**
   * Precio vigente para nuevas estimaciones.
   * Orden: DB (TTL válido) → memoria caliente → refresh único (APIs) → fallback.
   */
  async getCurrentDieselPrice(): Promise<number> {
    const dbSnapshot = await this.getCachedDieselPrice();
    if (dbSnapshot && !this.isCacheExpired(dbSnapshot.createdAt)) {
      this.logCacheHit('db', dbSnapshot);
      this.setMemoryCache(dbSnapshot);
      return dbSnapshot.pricePerLiter;
    }

    if (
      this.memoryCache &&
      !this.isCacheExpired(this.memoryCache.cachedAt)
    ) {
      this.logCacheHit('memory', {
        pricePerLiter: this.memoryCache.pricePerLiter,
        source: this.memoryCache.source,
        createdAt: this.memoryCache.cachedAt,
      });
      return this.memoryCache.pricePerLiter;
    }

    this.logger.log('[FuelPrice][CacheMiss] no valid db/memory cache');
    return this.refreshDieselPrice(dbSnapshot);
  }

  /** Último registro en DB (sin importar TTL). */
  async getCachedDieselPrice(): Promise<CachedFuelPrice | null> {
    const row = await this.fuelPricesRepo.findOne({
      where: { fuelType: FUEL_TYPE_DIESEL },
      order: { createdAt: 'DESC' },
    });
    if (!row) {
      return null;
    }
    const pricePerLiter = Number(row.pricePerLiter);
    if (!Number.isFinite(pricePerLiter) || pricePerLiter <= 0) {
      return null;
    }
    return {
      pricePerLiter,
      source: row.source,
      createdAt: row.createdAt,
    };
  }

  /**
   * Precio efectivo por empresa: override manual → sugerido nacional.
   * El sugerido proviene de `getCurrentDieselPrice()` (promedio / APIs / fallback).
   */
  async resolveDieselForCompany(
    company: CompanyDieselPriceInput,
  ): Promise<CompanyDieselPriceSnapshot> {
    const enabled = company.dieselControlEnabled !== false;
    if (!enabled) {
      return {
        enabled: false,
        pricePerLiter: null,
        suggestedPricePerLiter: null,
        source: null,
        updatedAt: null,
      };
    }

    let suggestedPricePerLiter: number | null = null;
    try {
      suggestedPricePerLiter = await this.getCurrentDieselPrice();
    } catch {
      const cached = await this.getCachedDieselPrice();
      suggestedPricePerLiter = cached?.pricePerLiter ?? null;
    }

    const companyPrice = parseStoredDieselPrice(company.dieselReferencePricePerLiter);
    if (companyPrice != null) {
      return {
        enabled: true,
        pricePerLiter: companyPrice,
        suggestedPricePerLiter,
        source: 'company',
        updatedAt: company.dieselReferencePriceUpdatedAt?.toISOString() ?? null,
      };
    }

    return {
      enabled: true,
      pricePerLiter: suggestedPricePerLiter,
      suggestedPricePerLiter,
      source: 'suggested',
      updatedAt: null,
    };
  }

  /**
   * Fuerza refresh (deduplicado). Si fallan APIs: DB stale (sin re-insertar) o config.
   */
  async refreshDieselPrice(
    staleDbSnapshot?: CachedFuelPrice | null,
  ): Promise<number> {
    if (this.refreshInFlight) {
      this.logger.debug('[FuelPrice][RefreshWait] joining in-flight refresh');
      return this.refreshInFlight;
    }
    this.isRefreshing = true;
    this.refreshInFlight = this.doRefreshDieselPrice(staleDbSnapshot).finally(
      () => {
        this.isRefreshing = false;
        this.refreshInFlight = null;
      },
    );
    return this.refreshInFlight;
  }

  private async doRefreshDieselPrice(
    staleDbSnapshot?: CachedFuelPrice | null,
  ): Promise<number> {
    this.logger.log('[FuelPrice][ExternalFetch] querying external sources');
    const quote = await this.tryExternalFetch();
    if (quote) {
      const saved = await this.persistPrice(quote.pricePerLiter, quote.source);
      this.setMemoryCache(saved);
      this.logger.log(
        `[FuelPrice][ExternalFetch] ok ${saved.pricePerLiter} MXN/L (${quote.source})`,
      );
      return saved.pricePerLiter;
    }

    const cached =
      staleDbSnapshot ?? (await this.getCachedDieselPrice());
    if (cached) {
      this.logger.warn(
        `[FuelPrice][Fallback] stale db ${cached.pricePerLiter} MXN/L (${cached.source}, ${cached.createdAt.toISOString()})`,
      );
      this.setMemoryCache(cached);
      return cached.pricePerLiter;
    }

    const fallback = this.fallbackPriceFromConfig();
    this.logger.warn(
      `[FuelPrice][Fallback] config ${fallback} MXN/L (no db rows)`,
    );
    const saved = await this.persistPrice(fallback, 'config:fallback');
    this.setMemoryCache(saved);
    return fallback;
  }

  private async tryExternalFetch() {
    try {
      return await fetchDieselFromExternalSources({
        apiNinjasKey: this.config.get('API_NINJAS_KEY', { infer: true }),
        oilPriceApiKey: this.config.get('OIL_PRICE_API_KEY', { infer: true }),
        oilPriceDieselCode: this.config.get('OIL_PRICE_API_DIESEL_CODE', {
          infer: true,
        }),
        datosGobCsvUrl: this.config.get('DATOS_GOB_MX_FUEL_CSV_URL', {
          infer: true,
        }),
      });
    } catch (err) {
      this.logger.error('[FuelPrice][Error] external fetch', err);
      return null;
    }
  }

  private async persistPrice(
    pricePerLiter: number,
    source: string,
  ): Promise<CachedFuelPrice> {
    const row = this.fuelPricesRepo.create({
      fuelType: FUEL_TYPE_DIESEL,
      pricePerLiter: String(round4(pricePerLiter)),
      source,
    });
    const saved = await this.fuelPricesRepo.save(row);
    return {
      pricePerLiter: Number(saved.pricePerLiter),
      source: saved.source,
      createdAt: saved.createdAt,
    };
  }

  private fallbackPriceFromConfig(): number {
    const raw = this.config.get('FUEL_DIESEL_FALLBACK_PRICE_MXN', {
      infer: true,
    });
    const n =
      raw != null && Number.isFinite(Number(raw)) && Number(raw) > 0
        ? Number(raw)
        : FUEL_PRICE_DEFAULTS.fallbackPriceMxnPerLiter;
    return round4(n);
  }

  private cacheTtlMs(): number {
    const hours = this.config.get('FUEL_PRICE_CACHE_TTL_HOURS', { infer: true });
    const h =
      hours != null && Number.isFinite(Number(hours)) && Number(hours) > 0
        ? Number(hours)
        : FUEL_PRICE_DEFAULTS.cacheTtlHours;
    return h * 60 * 60 * 1000;
  }

  private isCacheExpired(createdAt: Date): boolean {
    return Date.now() - createdAt.getTime() > this.cacheTtlMs();
  }

  private setMemoryCache(snapshot: CachedFuelPrice): void {
    this.memoryCache = {
      pricePerLiter: snapshot.pricePerLiter,
      source: snapshot.source,
      cachedAt: snapshot.createdAt,
    };
  }

  private logCacheHit(
    layer: 'db' | 'memory',
    snapshot: CachedFuelPrice,
  ): void {
    this.logger.debug(
      `[FuelPrice][CacheHit] ${layer} ${snapshot.pricePerLiter} MXN/L (${snapshot.source})`,
    );
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function parseStoredDieselPrice(raw?: string | null): number | null {
  if (raw == null || !String(raw).trim()) {
    return null;
  }
  const n = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 200) {
    return null;
  }
  return round4(n);
}
