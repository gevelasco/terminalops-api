import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FuelPrice, FUEL_TYPE_DIESEL } from './entities/fuel-price.entity';
import { FuelPriceService } from './fuel-price.service';
import * as external from './fuel-price-external.providers';

jest.mock('./fuel-price-external.providers');

describe('FuelPriceService', () => {
  let service: FuelPriceService;
  const save = jest.fn();
  const findOne = jest.fn();

  const freshRow = {
    fuelType: FUEL_TYPE_DIESEL,
    pricePerLiter: '24.0000',
    source: 'api-ninjas',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    freshRow.createdAt = new Date();
    findOne.mockResolvedValue(freshRow);
    save.mockImplementation(async (row: FuelPrice) => ({
      ...row,
      id: 2,
      createdAt: new Date(),
      pricePerLiter: row.pricePerLiter,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FuelPriceService,
        {
          provide: getRepositoryToken(FuelPrice),
          useValue: { findOne, save, create: (dto: object) => dto },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'FUEL_PRICE_CACHE_TTL_HOURS') {
                return 6;
              }
              if (key === 'FUEL_DIESEL_FALLBACK_PRICE_MXN') {
                return 25.5;
              }
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get(FuelPriceService);
  });

  it('returns fresh DB cache without calling external APIs', async () => {
    const price = await service.getCurrentDieselPrice();
    expect(price).toBe(24);
    expect(external.fetchDieselFromExternalSources).not.toHaveBeenCalled();
    expect(findOne).toHaveBeenCalled();
  });

  it('refreshes from external API when cache expired', async () => {
    freshRow.createdAt = new Date(Date.now() - 7 * 60 * 60 * 1000);
    (external.fetchDieselFromExternalSources as jest.Mock).mockResolvedValue({
      pricePerLiter: 26.12,
      source: 'api-ninjas:test',
    });

    const price = await service.refreshDieselPrice();
    expect(price).toBe(26.12);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('falls back to stale DB when external fetch fails (no extra persist)', async () => {
    freshRow.createdAt = new Date(Date.now() - 7 * 60 * 60 * 1000);
    (external.fetchDieselFromExternalSources as jest.Mock).mockResolvedValue(
      null,
    );

    const price = await service.refreshDieselPrice();
    expect(price).toBe(24);
    expect(save).not.toHaveBeenCalled();
  });

  it('dedupes concurrent refresh on cache miss', async () => {
    freshRow.createdAt = new Date(Date.now() - 7 * 60 * 60 * 1000);
    let resolveExternal!: (v: { pricePerLiter: number; source: string }) => void;
    (external.fetchDieselFromExternalSources as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExternal = resolve;
        }),
    );

    const p1 = service.getCurrentDieselPrice();
    const p2 = service.getCurrentDieselPrice();
    await Promise.resolve();
    await Promise.resolve();
    expect(external.fetchDieselFromExternalSources).toHaveBeenCalledTimes(1);
    expect(service.refreshing).toBe(true);

    resolveExternal({ pricePerLiter: 27, source: 'api-ninjas:concurrent' });
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe(27);
    expect(b).toBe(27);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('resolveDieselForCompany uses company override when set', async () => {
    const snapshot = await service.resolveDieselForCompany({
      dieselControlEnabled: true,
      dieselReferencePricePerLiter: '27.1500',
      dieselReferencePriceUpdatedAt: new Date('2026-06-19T15:00:00.000Z'),
    });

    expect(snapshot).toEqual({
      enabled: true,
      pricePerLiter: 27.15,
      suggestedPricePerLiter: 24,
      source: 'company',
      updatedAt: '2026-06-19T15:00:00.000Z',
    });
    expect(external.fetchDieselFromExternalSources).not.toHaveBeenCalled();
  });

  it('resolveDieselForCompany falls back to suggested when no override', async () => {
    const snapshot = await service.resolveDieselForCompany({
      dieselControlEnabled: true,
      dieselReferencePricePerLiter: null,
      dieselReferencePriceUpdatedAt: null,
    });

    expect(snapshot.source).toBe('suggested');
    expect(snapshot.pricePerLiter).toBe(24);
    expect(snapshot.suggestedPricePerLiter).toBe(24);
  });
});
