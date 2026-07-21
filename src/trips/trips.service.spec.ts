import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { Company } from 'src/companies/entities/company.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { ExpensesService } from 'src/expenses/expenses.service';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { AppUser } from 'src/users/entities/app-user.entity';
import { DestinationRatesService } from 'src/destination-rates/destination-rates.service';
import { OperationConfigurationsService } from 'src/operation-configurations/operation-configurations.service';
import { OperationalCentersService } from 'src/operational-centers/operational-centers.service';
import { TripFleetStatusSyncService } from './lifecycle/trip-fleet-status-sync.service';
import { TripLifecycleService } from './lifecycle/trip-lifecycle.service';
import { UnitTripOdometerService } from 'src/units/unit-trip-odometer.service';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { TRIP_SNAPSHOT_IMMUTABLE_MESSAGE } from './trip-snapshot-immutability.util';
import { TripLoadPlacesService } from './trip-load-places.service';
import { TripsService } from './trips.service';

const TRIP_STATUS_LOCK_MESSAGE = 'Trip status is system-owned';

describe('TripsService.update (A4 snapshot immutability)', () => {
  let service: TripsService;

  const tripsFindOne = jest.fn();
  const tripsUpdate = jest.fn();
  const unitsFindOne = jest.fn();

  const baseTrip = {
    id: 10,
    companyId: 1,
    status: 'scheduled',
    tripEquipment: [],
    destinationRateId: 5,
    hasClientBilling: true,
  } as unknown as Trip;

  beforeEach(async () => {
    jest.clearAllMocks();
    tripsFindOne.mockImplementation(async (opts: { select?: string[] }) => {
      if (opts?.select?.includes('maneuverCode')) {
        return null;
      }
      return { ...baseTrip };
    });
    tripsUpdate.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: getRepositoryToken(Trip), useValue: { findOne: tripsFindOne, update: tripsUpdate, save: jest.fn(), delete: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(TripEquipment), useValue: { delete: jest.fn(), save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(TripIncident), useValue: { save: jest.fn(), create: jest.fn() } },
        { provide: getRepositoryToken(Equipment), useValue: { find: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(Client), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Company), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Unit), useValue: { findOne: unitsFindOne } },
        { provide: getRepositoryToken(Operator), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(AppUser), useValue: { find: jest.fn() } },
        { provide: OperationConfigurationsService, useValue: { findByCode: jest.fn() } },
        { provide: DestinationRatesService, useValue: {} },
        { provide: OperationalCentersService, useValue: {} },
        { provide: TripLifecycleService, useValue: { applyLifecycleChainForTrip: jest.fn(), ensureCompanyLifecycleFresh: jest.fn().mockResolvedValue({ scanned: 0, transitioned: 0, skipped: 0 }) } },
        { provide: TripFleetStatusSyncService, useValue: { syncForTrip: jest.fn(), syncForTripAfterUpdate: jest.fn(), reconcileReleasedFleetResources: jest.fn() } },
        { provide: UnitTripOdometerService, useValue: { reverseCreditForTrip: jest.fn(), creditUnitForCompletedTrip: jest.fn() } },
        { provide: ExpensesService, useValue: {} },
        { provide: ActivityEventsService, useValue: { record: jest.fn() } },
        { provide: TripLoadPlacesService, useValue: { findOrCreate: jest.fn() } },
      ],
    }).compile();

    service = module.get(TripsService);
  });

  it('rechaza PATCH con cambio de origen (400)', async () => {
    await expect(
      service.update(1, 10, {}, { originPostalCode: '64000' }),
    ).rejects.toThrow(new BadRequestException(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE));
    expect(tripsFindOne).not.toHaveBeenCalled();
  });

  it('rechaza PATCH con cambio de destino (400)', async () => {
    await expect(
      service.update(1, 10, {}, { destinationLocality: 'Otro' }),
    ).rejects.toThrow(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
    expect(tripsFindOne).not.toHaveBeenCalled();
  });

  it('rechaza PATCH con destination_rate_id (400)', async () => {
    await expect(
      service.update(1, 10, {}, { destinationRateId: '99' }),
    ).rejects.toThrow(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
  });

  it('rechaza PATCH con status (400)', async () => {
    await expect(
      service.update(1, 10, { status: 'in_transit' } as never, {
        status: 'in_transit',
      }),
    ).rejects.toThrow(TRIP_STATUS_LOCK_MESSAGE);
    expect(tripsFindOne).not.toHaveBeenCalled();
  });

  it('permite PATCH de unitId (asignación)', async () => {
    unitsFindOne.mockResolvedValue({ id: 3, companyId: 1 });
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: '10' } as never);

    await service.update(1, 10, { unitId: '3' }, { unitId: '3' });

    expect(tripsUpdate).toHaveBeenCalledWith(
      { id: 10, companyId: 1 },
      expect.objectContaining({
        unitId: 3,
      }),
    );
    expect(unitsFindOne).toHaveBeenCalled();
  });
});
