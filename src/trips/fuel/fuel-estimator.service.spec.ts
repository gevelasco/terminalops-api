import { FuelPriceService } from 'src/fuel/fuel-price.service';
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

  it('estimates sencillo vacío local', async () => {
    const res = await service.estimate({
      distanceKm: 20,
      configuration: 'sencillo',
      approximateWeightTons: 0,
      cargoType: 'vacio',
      containerType: 'na',
    });
    expect(res.calculationProfile).toBe('sencillo_vacio');
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

  it('uses round trip by default (100 km → 200 km efectivos)', async () => {
    const base = {
      configuration: 'sencillo' as const,
      approximateWeightTons: 10,
      cargoType: 'lleno',
      containerType: 'na',
    };
    const roundTripDefault = await service.estimate({ ...base, distanceKm: 100 });
    const oneWay = await service.estimate({
      ...base,
      distanceKm: 100,
      isRoundTrip: false,
    });
    expect(roundTripDefault.adjustments.effectiveDistanceKm).toBe(200);
    expect(roundTripDefault.estimatedLiters).toBeCloseTo(
      oneWay.estimatedLiters * 2,
      1,
    );
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
});
