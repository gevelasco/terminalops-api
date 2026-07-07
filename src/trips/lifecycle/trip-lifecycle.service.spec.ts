import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Trip } from '../entities/trip.entity';
import { TripIncident } from '../entities/trip-incident.entity';
import { TripAuditService } from './trip-audit.service';
import { TripFleetStatusSyncService } from './trip-fleet-status-sync.service';
import { TripLifecycleService } from './trip-lifecycle.service';
import { UnitTripOdometerService } from 'src/units/unit-trip-odometer.service';
import { ACTIVE_TRIP_LIFECYCLE_STATUSES } from './trip-lifecycle.types';

describe('TripLifecycleService', () => {
  let service: TripLifecycleService;

  const tripsFind = jest.fn();
  const tripsFindOne = jest.fn().mockResolvedValue(null);
  const tripsUpdate = jest.fn().mockResolvedValue({ affected: 1 });
  const incidentsFind = jest.fn().mockResolvedValue([]);
  const qbGetMany = jest.fn();
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: qbGetMany,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    qbGetMany.mockResolvedValue([]);
    tripsFind.mockResolvedValue([]);
    tripsUpdate.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripLifecycleService,
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            find: tripsFind,
            findOne: tripsFindOne,
            update: tripsUpdate,
          },
        },
        {
          provide: getRepositoryToken(TripIncident),
          useValue: {
            find: incidentsFind,
          },
        },
        {
          provide: TripAuditService,
          useValue: { recordLifecycleStatusChange: jest.fn() },
        },
        {
          provide: TripFleetStatusSyncService,
          useValue: { syncForTrip: jest.fn() },
        },
        {
          provide: UnitTripOdometerService,
          useValue: { creditUnitForCompletedTrip: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { query: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(TripLifecycleService);
  });

  it('ensureTripLifecycleFresh no escanea toda la empresa', async () => {
    tripsFindOne.mockResolvedValue({
      id: 3,
      companyId: 42,
      status: 'completed',
      plannedDepartureAt: new Date('2026-01-01'),
      plannedCompletionAt: new Date('2026-01-02'),
    });

    await service.ensureTripLifecycleFresh(42, 3);

    expect(queryBuilder.getMany).not.toHaveBeenCalled();
    expect(tripsUpdate).not.toHaveBeenCalled();
  });

  it('ensureCompanyLifecycleFresh filtra solo programadas/en curso de la empresa', async () => {
    await service.ensureCompanyLifecycleFresh(42);

    expect(queryBuilder.where).toHaveBeenCalledWith(
      'trip.status IN (:...statuses)',
      { statuses: [...ACTIVE_TRIP_LIFECYCLE_STATUSES] },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'trip.companyId = :companyId',
      { companyId: 42 },
    );
    expect(tripsFind).not.toHaveBeenCalled();
  });

  it('coalesce llamadas concurrentes por empresa', async () => {
    let resolveGetMany!: (value: Trip[]) => void;
    qbGetMany.mockReturnValue(
      new Promise<Trip[]>((resolve) => {
        resolveGetMany = resolve;
      }),
    );

    const first = service.ensureCompanyLifecycleFresh(7);
    const second = service.ensureCompanyLifecycleFresh(7);

    resolveGetMany([]);

    await Promise.all([first, second]);

    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
  });
});
