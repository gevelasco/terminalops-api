import { Injectable } from '@nestjs/common';
import { FuelPriceService } from 'src/fuel/fuel-price.service';
import type {
  FuelEstimateRequestDto,
  FuelEstimateResponseDto,
} from '../dto/fuel-estimate.dto';
import { resolveTripOperationalDistance } from '../trip-operational-distance.util';
import {
  BASE_KM_PER_LITER,
  EMPTY_CONTAINER_TONS,
  LOCAL_ROUTE_MAX_KM,
  ROUTE_FACTOR_FORANEA,
  ROUTE_FACTOR_LOCAL,
  WEIGHT_BUCKETS,
  WEIGHT_LOAD_COEFFICIENT,
} from './fuel-estimator.config';

@Injectable()
export class FuelEstimatorService {
  constructor(private readonly fuelPriceService: FuelPriceService) {}

  /**
   * Estimación operativa: viaje redondo con ida cargada y regreso vacío.
   * Litros = km_ida / r_cargado + km_regreso / r_vacío (km_ida = km_regreso = OSRM).
   */
  async estimate(
    dto: FuelEstimateRequestDto,
    options?: { dieselPricePerLiter?: number },
  ): Promise<FuelEstimateResponseDto> {
    const {
      routeDistanceKm,
      operationalDistanceKm,
      roundTripFactor,
    } = resolveTripOperationalDistance(dto.distanceKm);
    const unitPerformanceKmL = this.resolveUnitPerformanceKmL(
      dto.unitPerformanceKmL,
    );

    const merchandiseTons = Math.max(0, dto.approximateWeightTons);
    const emptyTons = EMPTY_CONTAINER_TONS;
    const outboundTons = this.resolveOutboundTons(merchandiseTons);

    /** Clasificación local/foránea sobre la pierna OSRM (solo ida). */
    const routeFactor =
      routeDistanceKm <= LOCAL_ROUTE_MAX_KM
        ? ROUTE_FACTOR_LOCAL
        : ROUTE_FACTOR_FORANEA;
    const configurationFactor = 1;

    let profileKey: string;
    let outboundKmPerLiter: number;
    let returnKmPerLiter: number;
    let weightFactor: number;

    if (unitPerformanceKmL != null) {
      profileKey = 'unit_performance_round_trip';
      outboundKmPerLiter = this.performanceForTons(
        unitPerformanceKmL,
        outboundTons,
      );
      returnKmPerLiter = this.performanceForTons(
        unitPerformanceKmL,
        emptyTons,
      );
      weightFactor = this.continuousWeightFactor(outboundTons);
    } else {
      const configuration = dto.configuration;
      const loadedKey = `${configuration}_loaded`;
      const emptyKey = `${configuration}_vacio`;
      profileKey = loadedKey;

      const baseOutbound =
        BASE_KM_PER_LITER[loadedKey] ?? BASE_KM_PER_LITER['sencillo_loaded'];
      const baseReturn =
        BASE_KM_PER_LITER[emptyKey] ?? BASE_KM_PER_LITER['sencillo_vacio'];

      const outboundWeightFactor = this.weightFactorForTons(outboundTons);
      const returnWeightFactor = this.weightFactorForTons(emptyTons);
      weightFactor = outboundWeightFactor;

      outboundKmPerLiter =
        baseOutbound * outboundWeightFactor * routeFactor * configurationFactor;
      returnKmPerLiter =
        baseReturn * returnWeightFactor * routeFactor * configurationFactor;
    }

    const outboundLiters =
      outboundKmPerLiter > 0 ? routeDistanceKm / outboundKmPerLiter : 0;
    const returnLiters =
      returnKmPerLiter > 0 ? routeDistanceKm / returnKmPerLiter : 0;
    const estimatedLiters = outboundLiters + returnLiters;

    const estimatedKmPerLiter =
      estimatedLiters > 0 ? operationalDistanceKm / estimatedLiters : 0;

    const dieselPricePerLiter =
      options?.dieselPricePerLiter ??
      (await this.fuelPriceService.getCurrentDieselPrice());

    const estimatedDieselCost = estimatedLiters * dieselPricePerLiter;

    return {
      estimatedLiters: round1(estimatedLiters),
      estimatedKmPerLiter: round2(estimatedKmPerLiter),
      estimatedDieselCost: round2(estimatedDieselCost),
      dieselPricePerLiter: round2(dieselPricePerLiter),
      calculationProfile: profileKey,
      routeDistanceKm: round1(routeDistanceKm),
      operationalDistanceKm: round1(operationalDistanceKm),
      adjustments: {
        weightFactor: round3(weightFactor),
        configurationFactor,
        routeFactor: unitPerformanceKmL != null ? 1 : routeFactor,
        roundTripFactor,
        effectiveDistanceKm: round1(operationalDistanceKm),
      },
    };
  }

  /**
   * Peso de ida: mercancía + tara, sin duplicar si el capturado ya es ≈ tara.
   */
  private resolveOutboundTons(merchandiseTons: number): number {
    if (merchandiseTons <= 0) {
      return EMPTY_CONTAINER_TONS;
    }
    if (merchandiseTons <= EMPTY_CONTAINER_TONS) {
      return merchandiseTons;
    }
    return merchandiseTons + EMPTY_CONTAINER_TONS;
  }

  /** Rendimiento efectivo km/L según toneladas (derating continuo). */
  private performanceForTons(baseKmPerLiter: number, tons: number): number {
    return baseKmPerLiter * this.continuousWeightFactor(tons);
  }

  private continuousWeightFactor(tons: number): number {
    const load = Math.max(0, tons);
    return 1 / (1 + WEIGHT_LOAD_COEFFICIENT * load);
  }

  private resolveUnitPerformanceKmL(
    value: number | null | undefined,
  ): number | null {
    if (value == null || !Number.isFinite(value) || value <= 0) {
      return null;
    }
    return value;
  }

  private weightFactorForTons(tons: number): number {
    for (const bucket of WEIGHT_BUCKETS) {
      const max = bucket.maxTons;
      if (tons >= bucket.minTons && (max === null || tons < max)) {
        return bucket.factor;
      }
    }
    const last = WEIGHT_BUCKETS[WEIGHT_BUCKETS.length - 1];
    return last?.factor ?? 0.75;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
