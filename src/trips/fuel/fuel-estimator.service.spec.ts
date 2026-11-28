import { FuelPriceService } from 'src/fuel/fuel-price.service';
import {
  EMPTY_CONTAINER_TONS,
  WEIGHT_LOAD_COEFFICIENT,
} from './fuel-estimator.config';
import { FuelEstimatorService } from './fuel-estimator.service';

describe('FuelEstimatorService', () => {
  const getCurrentDieselPrice = jest.fn().mockResolvedValue(25.5);
  const fuelPriceService = {
    getCurrentDieselPrice,
  } as unknown as FuelPriceService;

  const service = new FuelEstimatorService(fuelPriceService);

  beforeEach(() => {
    getCurrentDieselPrice.mockClear();
    getCurrentDieselPrice.mockResolvedValue(25.5);
  });

  it('estima sencillo foránea como ida cargada + regreso vacío (heurística)', async () => {
    const res = await service.estimate({
      distanceKm: 720,
      configuration: 'sencillo',
      approximateWeightTons: 0,
      cargoType: 'vacio',
      containerType: 'na',
    });
    expect(res.calculationProfile).toBe('sencillo_loaded');
    expect(res.operationalDistanceKm).toBe(1440);
    expect(res.estimatedLiters).toBeGreaterThan(0);
    expect(res.adjustments.roundTripFactor).toBe(2);
  });

  it('estimates sencillo vacío local (regreso también vacío)', async () => {
    const res = await service.estimate({
      distanceKm: 20,
      configuration: 'sencillo',
      approximateWeightTons: 0,
      cargoType: 'vacio',
      containerType: 'na',
    });
    expect(res.calculationProfile).toBe('sencillo_loaded');
    expect(res.routeDistanceKm).toBe(20);
    expect(res.operationalDistanceKm).toBe(40);
    expect(res.adjustments.routeFactor).toBe(0.9);
    expect(res.estimatedLiters).toBeGreaterThan(0);
    expect(res.dieselPricePerLiter).toBe(25.5);
  });

  it('estimates full cargado foránea', async () => {
    const res = await service.estimate({
      distanceKm: 120,
      configuration: 'full',
      approximateWeightTons: 18,
      cargoType: 'lleno',
      containerType: '40dc',
    });
    expect(res.calculationProfile).toBe('full_loaded');
    expect(res.adjustments.routeFactor).toBe(1);
    expect(res.adjustments.roundTripFactor).toBe(2);
    expect(res.adjustments.effectiveDistanceKm).toBe(240);
    expect(res.estimatedLiters).toBeGreaterThan(40);
  });

  it('always uses round-trip distance (×2)', async () => {
    const res = await service.estimate({
      distanceKm: 100,
      configuration: 'sencillo',
      approximateWeightTons: 10,
      cargoType: 'lleno',
      containerType: 'na',
    });
    expect(res.operationalDistanceKm).toBe(200);
    expect(res.adjustments.roundTripFactor).toBe(2);
    expect(res.adjustments.effectiveDistanceKm).toBe(200);
  });

  it('usa rendimiento de unidad con ida cargada + regreso vacío 3.5 t', async () => {
    const km = 100;
    const perf = 2.5;
    const cargo = 20;
    const outboundTons = cargo + EMPTY_CONTAINER_TONS;
    const rOut = perf / (1 + WEIGHT_LOAD_COEFFICIENT * outboundTons);
    const rRet = perf / (1 + WEIGHT_LOAD_COEFFICIENT * EMPTY_CONTAINER_TONS);
    const expectedLiters = km / rOut + km / rRet;

    const res = await service.estimate({
      distanceKm: km,
      configuration: 'sencillo',
      approximateWeightTons: cargo,
      cargoType: 'lleno',
      containerType: 'na',
      unitPerformanceKmL: perf,
    });
    expect(res.calculationProfile).toBe('unit_performance_round_trip');
    expect(res.operationalDistanceKm).toBe(200);
    expect(res.estimatedLiters).toBe(Math.round(expectedLiters * 10) / 10);
    expect(res.estimatedDieselCost).toBe(
      Math.round(res.estimatedLiters * 25.5 * 100) / 100,
    );
  });

  it('mayor peso implica mayor consumo (misma distancia y rendimiento)', async () => {
    const light = await service.estimate({
      distanceKm: 500,
      configuration: 'sencillo',
      approximateWeightTons: 10,
      cargoType: 'lleno',
      containerType: 'na',
      unitPerformanceKmL: 2.8,
    });
    const heavy = await service.estimate({
      distanceKm: 500,
      configuration: 'sencillo',
      approximateWeightTons: 32,
      cargoType: 'lleno',
      containerType: 'na',
      unitPerformanceKmL: 2.8,
    });
    expect(heavy.estimatedLiters).toBeGreaterThan(light.estimatedLiters);
  });

  it('regreso vacío consume menos que ida cargada (piernas simétricas en km)', async () => {
    const km = 800;
    const perf = 2.8;
    const cargo = 27;
    const outboundTons = cargo + EMPTY_CONTAINER_TONS;
    const rOut = perf / (1 + WEIGHT_LOAD_COEFFICIENT * outboundTons);
    const rRet = perf / (1 + WEIGHT_LOAD_COEFFICIENT * EMPTY_CONTAINER_TONS);
    expect(km / rOut).toBeGreaterThan(km / rRet);

    const res = await service.estimate({
      distanceKm: km,
      configuration: 'sencillo',
      approximateWeightTons: cargo,
      cargoType: 'lleno',
      containerType: 'na',
      unitPerformanceKmL: perf,
    });
    expect(res.estimatedLiters).toBe(
      Math.round((km / rOut + km / rRet) * 10) / 10,
    );
  });

  it('distintos rendimientos de unidad producen distintos litros', async () => {
    const a = await service.estimate({
      distanceKm: 600,
      configuration: 'sencillo',
      approximateWeightTons: 22,
      cargoType: 'lleno',
      containerType: 'na',
      unitPerformanceKmL: 2.4,
    });
    const b = await service.estimate({
      distanceKm: 600,
      configuration: 'sencillo',
      approximateWeightTons: 22,
      cargoType: 'lleno',
      containerType: 'na',
      unitPerformanceKmL: 3.0,
    });
    expect(a.estimatedLiters).toBeGreaterThan(b.estimatedLiters);
  });

  it('cambiar precio modifica costo pero no litros', async () => {
    const base = await service.estimate(
      {
        distanceKm: 400,
        configuration: 'sencillo',
        approximateWeightTons: 18,
        cargoType: 'lleno',
        containerType: 'na',
        unitPerformanceKmL: 2.8,
      },
      { dieselPricePerLiter: 27 },
    );
    const dear = await service.estimate(
      {
        distanceKm: 400,
        configuration: 'sencillo',
        approximateWeightTons: 18,
        cargoType: 'lleno',
        containerType: 'na',
        unitPerformanceKmL: 2.8,
      },
      { dieselPricePerLiter: 30 },
    );
    expect(base.estimatedLiters).toBe(dear.estimatedLiters);
    expect(dear.estimatedDieselCost).toBeGreaterThan(base.estimatedDieselCost);
  });

  it('no duplica tara si el peso capturado ya es ≤ tara vacía', async () => {
    const withTaraOnly = await service.estimate({
      distanceKm: 100,
      configuration: 'sencillo',
      approximateWeightTons: 3.5,
      cargoType: 'lleno',
      containerType: 'na',
      unitPerformanceKmL: 2.8,
    });
    const emptyDefault = await service.estimate({
      distanceKm: 100,
      configuration: 'sencillo',
      approximateWeightTons: 0,
      cargoType: 'vacio',
      containerType: 'na',
      unitPerformanceKmL: 2.8,
    });
    expect(withTaraOnly.estimatedLiters).toBe(emptyDefault.estimatedLiters);
  });

  it('allows manual diesel override without calling FuelPriceService', async () => {
    const res = await service.estimate(
      {
        distanceKm: 10,
        configuration: 'sencillo',
        approximateWeightTons: 0,
        cargoType: 'vacio',
        containerType: 'na',
      },
      { dieselPricePerLiter: 30 },
    );
    expect(res.dieselPricePerLiter).toBe(30);
    expect(getCurrentDieselPrice).not.toHaveBeenCalled();
  });

  describe('banda de calibración (proxy de km públicos)', () => {
    const perf = 2.8;
    const price = 27;

    async function liters(
      distanceKm: number,
      cargoTons: number,
    ): Promise<number> {
      const res = await service.estimate(
        {
          distanceKm,
          configuration: 'sencillo',
          approximateWeightTons: cargoTons,
          cargoType: 'lleno',
          containerType: '40dc',
          unitPerformanceKmL: perf,
        },
        { dieselPricePerLiter: price },
      );
      return res.estimatedLiters;
    }

    it('Tierra Blanca 32 t ≈ ±15 % de 1 296 L', async () => {
      const est = await liters(1118, 32);
      expect(est).toBeGreaterThan(1296.3 * 0.85);
      expect(est).toBeLessThan(1296.3 * 1.15);
    });

    it('Apodaca 27 t ≈ ±15 % de 1 111 L', async () => {
      const est = await liters(1111, 27);
      expect(est).toBeGreaterThan(1111.11 * 0.85);
      expect(est).toBeLessThan(1111.11 * 1.15);
    });

    it('Toluca 20 t ≈ banda amplia vs 600 L', async () => {
      const est = await liters(700, 20);
      expect(est).toBeGreaterThan(600 * 0.8);
      expect(est).toBeLessThan(600 * 1.35);
    });
  });
});
