import { Injectable } from '@nestjs/common';
import { FuelPriceService } from 'src/fuel/fuel-price.service';
import type {
  FuelEstimateRequestDto,
  FuelEstimateResponseDto,
} from '../dto/fuel-estimate.dto';
import { resolveTripOperationalDistance } from '../trip-operational-distance.util';
import {
  BASE_KM_PER_LITER,
  LOCAL_ROUTE_MAX_KM,
  ROUTE_FACTOR_FORANEA,
  ROUTE_FACTOR_LOCAL,
  WEIGHT_BUCKETS,
} from './fuel-estimator.config';

@Injectable()
export class FuelEstimatorService {
  constructor(private readonly fuelPriceService: FuelPriceService) {}

  /**
   * Estimación operativa MVP (heurística).
   * Ida/vuelta solo en `resolveTripOperationalDistance`; litros usan `operationalDistanceKm`.
   */
  async estimate(
    dto: FuelEstimateRequestDto,
    options?: { dieselPricePerLiter?: number },
  ): Promise<FuelEstimateResponseDto> {
    const {
      routeDistanceKm,
      operationalDistanceKm,
      roundTripFactor,
    } = resolveTripOperationalDistance(dto.distanceKm, dto.isRoundTrip);
    const configuration = dto.configuration;
    const weightTons = Math.max(0, dto.approximateWeightTons);
    const loaded = this.isLoadedCargo(dto.cargoType);

    const profileKey = `${configuration}_${loaded ? 'loaded' : 'vacio'}`;
    const baseKmPerLiter =
      BASE_KM_PER_LITER[profileKey] ?? BASE_KM_PER_LITER['sencillo_vacio'];

    const weightFactor = this.weightFactorForTons(weightTons);
    /** Clasificación local/foránea sobre la pierna OSRM (solo ida). */
    const routeFactor =
      routeDistanceKm <= LOCAL_ROUTE_MAX_KM
        ? ROUTE_FACTOR_LOCAL
        : ROUTE_FACTOR_FORANEA;

    const configurationFactor = 1;
    const adjustedKmPerLiter =
      baseKmPerLiter * weightFactor * routeFactor * configurationFactor;

    const estimatedLiters =
      adjustedKmPerLiter > 0
        ? operationalDistanceKm / adjustedKmPerLiter
        : 0;

    const dieselPricePerLiter =
      options?.dieselPricePerLiter ??
      (await this.fuelPriceService.getCurrentDieselPrice());

    const estimatedDieselCost = estimatedLiters * dieselPricePerLiter;

    return {
      estimatedLiters: round1(estimatedLiters),
      estimatedKmPerLiter: round2(adjustedKmPerLiter),
      estimatedDieselCost: round2(estimatedDieselCost),
      dieselPricePerLiter: round2(dieselPricePerLiter),
      calculationProfile: profileKey,
      routeDistanceKm: round1(routeDistanceKm),
      operationalDistanceKm: round1(operationalDistanceKm),
      adjustments: {
        weightFactor: round3(weightFactor),
        configurationFactor,
        routeFactor,
        roundTripFactor,
        effectiveDistanceKm: round1(operationalDistanceKm),
      },
    };
  }

  private isLoadedCargo(cargoType: string | null | undefined): boolean {
    const t = (cargoType ?? '').trim().toLowerCase();
    if (!t) {
      return false;
    }
    return t === 'lleno' || t === 'loaded' || t === 'full' || t === 'cargado';
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
