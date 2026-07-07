import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { FuelPriceService } from 'src/fuel/fuel-price.service';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripLifecycleService } from 'src/trips/lifecycle/trip-lifecycle.service';
import { Unit } from 'src/units/entities/unit.entity';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const tripsRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
    metadata: { schema: 'terminalops' },
  };
  const unitsRepo = {
    count: jest.fn(),
  };
  const equipmentRepo = {
    count: jest.fn(),
  };
  const expensesRepo = {
    createQueryBuilder: jest.fn(),
    metadata: { schema: 'terminalops' },
  };
  const companiesRepo = {
    findOne: jest.fn(),
  };
  const fuelPriceService = {
    resolveDieselForCompany: jest.fn(),
  };
  const tripLifecycleService = {
    ensureCompanyLifecycleFresh: jest.fn().mockResolvedValue({
      scanned: 0,
      transitioned: 0,
      skipped: 0,
    }),
  };

  function mockTripQb(
    count: number,
    sum = '0',
    rawOne: Record<string, unknown> = { sum },
  ) {
    const chain = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(count),
      getRawOne: jest.fn().mockResolvedValue(rawOne),
    };
    return chain;
  }

  function mockExpenseKindQb(rows: unknown[] = []) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
  }

  function mockExpenseQb(sum: string, count: number, kindRows: unknown[] = []) {
    return {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum }),
      getCount: jest.fn().mockResolvedValue(count),
      getRawMany: jest.fn().mockResolvedValue(kindRows),
    };
  }

  function mockRawManyQb(rows: unknown[] = []) {
    const chain = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    return chain;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    tripsRepo.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(7);
    tripsRepo.createQueryBuilder
      .mockReturnValueOnce(mockTripQb(0, '0', { count: '3' }))
      .mockReturnValueOnce(mockTripQb(8))
      .mockReturnValueOnce(mockTripQb(5))
      .mockReturnValueOnce(
        mockTripQb(0, '0', { nextAt: new Date('2026-06-20T14:30:00.000Z') }),
      )
      .mockReturnValueOnce(
        mockTripQb(0, '0', { collected: '12000', receivable: '3000' }),
      )
      .mockReturnValueOnce(mockTripQb(2));
    unitsRepo.count.mockResolvedValue(4);
    equipmentRepo.count.mockResolvedValue(6);
    expensesRepo.createQueryBuilder
      .mockReturnValueOnce(mockExpenseQb('3200', 5))
      .mockReturnValueOnce(mockExpenseQb('3200', 5))
      .mockReturnValueOnce(
        mockExpenseKindQb([
          { kind: 'fuel', has_trip: '1', sum: '2000', count: '2' },
          { kind: 'maintenance', has_trip: '0', sum: '1200', count: '1' },
        ]),
      );
    companiesRepo.findOne.mockResolvedValue({
      id: 1,
      dieselControlEnabled: true,
      dieselReferencePricePerLiter: null,
      dieselReferencePriceUpdatedAt: null,
    });
    fuelPriceService.resolveDieselForCompany.mockResolvedValue({
      enabled: true,
      pricePerLiter: 25.5,
      suggestedPricePerLiter: 25.5,
      source: 'suggested',
      updatedAt: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Trip), useValue: tripsRepo },
        { provide: getRepositoryToken(Unit), useValue: unitsRepo },
        { provide: getRepositoryToken(Equipment), useValue: equipmentRepo },
        { provide: getRepositoryToken(Expense), useValue: expensesRepo },
        { provide: getRepositoryToken(Company), useValue: companiesRepo },
        { provide: FuelPriceService, useValue: fuelPriceService },
        { provide: TripLifecycleService, useValue: tripLifecycleService },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('getSummary returns live status counts and calendar-day result', async () => {
    const summary = await service.getSummary(1);

    expect(tripLifecycleService.ensureCompanyLifecycleFresh).toHaveBeenCalledWith(1);
    expect(summary.tripsInTransit).toBe(2);
    expect(summary.tripsInTransitDestinations).toBe(3);
    expect(summary.unitsAvailable).toBe(4);
    expect(summary.equipmentAvailable).toBe(6);
    expect(summary.tripsScheduled).toBe(7);
    expect(summary.tripsScheduledWeekOverWeekPercent).toBe(60);
    expect(summary.nextScheduledDepartureAt).toBe('2026-06-20T14:30:00.000Z');
    expect(summary.dailyResult).toEqual({
      revenue: 15000,
      expenses: 3200,
      margin: 11800,
      completedTripsCount: 2,
      expensesCount: 5,
      periodDistribution: {
        collectedRevenue: 12000,
        receivableRevenue: 3000,
        expensesByRubro: [
          { rubro: 'maniobra', label: 'Maniobra', amount: 2000, count: 2 },
          { rubro: 'mantenimiento', label: 'Mantenimiento', amount: 1200, count: 1 },
        ],
      },
    });
    expect(summary.diesel.pricePerLiter).toBe(25.5);
    expect(summary.diesel.suggestedPricePerLiter).toBe(25.5);
    expect(summary.diesel.source).toBe('suggested');
  });

  it('getInsights returns trip activity series without financial fields', async () => {
    tripsRepo.query.mockReset();
    tripsRepo.createQueryBuilder.mockReset();
    tripsRepo.query
      .mockResolvedValueOnce([
        { date: '2026-06-01', trips: 2, expenses: 100, revenue: 500 },
      ])
      .mockResolvedValueOnce([
        { date: '2026-06-01', completed: 2, in_transit: 1, scheduled: 3 },
      ]);
    tripsRepo.createQueryBuilder
      .mockReturnValueOnce(mockRawManyQb())
      .mockReturnValueOnce(mockRawManyQb())
      .mockReturnValueOnce(mockRawManyQb());

    const insights = await service.getInsights(1);

    expect(insights.tripActivity).toEqual([
      { date: '2026-06-01', completed: 2, inTransit: 1, scheduled: 3 },
    ]);
    expect(insights.operationalFlow[0]).toMatchObject({
      date: '2026-06-01',
      trips: 2,
    });
  });
});
