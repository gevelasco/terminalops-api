import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FleetBrandsService } from 'src/fleet/fleet-brands.service';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { UnitFleetDocument } from 'src/units/entities/unit-fleet-document.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitTripOdometerService } from './unit-trip-odometer.service';
import { UnitsService } from './units.service';
import { FleetMaintenanceWorkflowService } from 'src/fleet/fleet-maintenance-workflow.service';
import { FleetMaintenanceExpenseSyncService } from 'src/fleet/fleet-maintenance-expense-sync.service';
import { FleetVerificationExpenseSyncService } from 'src/fleet/fleet-verification-expense-sync.service';
import { FleetInsuranceExpenseSyncService } from 'src/fleet/fleet-insurance-expense-sync.service';
import { FleetGpsExpenseSyncService } from 'src/fleet/fleet-gps-expense-sync.service';

describe('UnitsService (A6 fleet status lock)', () => {
  let service: UnitsService;

  const unitRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto: object) => dto),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const profileRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto: object) => dto),
  };
  const maintenanceRepo = {
    find: jest.fn(),
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto: object) => dto),
  };
  const documentsRepo = {
    delete: jest.fn(),
    save: jest.fn(),
    create: jest.fn((dto: object) => dto),
  };
  const fleetTenureService = {
    upsertFromFleetMeta: jest.fn(),
    findByUnit: jest.fn(),
    findAllForCompany: jest.fn(),
    buildLookupMap: jest.fn(),
  };
  const fleetBrandsService = {
    findOrCreateBrand: jest.fn(),
    findOrCreateVersion: jest.fn(),
  };
  const unitTripOdometer = {
    ensureMaintenanceKmCounterInitialized: jest.fn(),
    creditUnitForCompletedTrip: jest.fn(),
    reverseCreditForTrip: jest.fn(),
  };
  const maintenanceWorkflow = {
    startUnitMaintenance: jest.fn(),
    endUnitMaintenance: jest.fn(),
  };
  const maintenanceExpenseSync = {
    syncForMaintenanceSave: jest.fn(),
  };
  const verificationExpenseSync = {
    syncForUnitVerificationSave: jest.fn(),
  };
  const insuranceExpenseSync = {
    syncForInsurancePaymentSave: jest.fn(),
    ensureInitialInsurancePremium: jest.fn(),
  };
  const gpsExpenseSync = {
    syncForGpsPaymentSave: jest.fn(),
    ensureInitialGpsService: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    unitRepo.findOne.mockResolvedValue({
      id: 7,
      companyId: 1,
      plate: 'ABC',
      status: 'available',
      fleetProfile: null,
      maintenanceEntries: [],
      fleetDocuments: [],
      equipment: [],
    });
    maintenanceRepo.find.mockResolvedValue([]);
    profileRepo.findOne.mockResolvedValue(null);
    fleetTenureService.findByUnit.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitsService,
        { provide: getRepositoryToken(Unit), useValue: unitRepo },
        { provide: getRepositoryToken(UnitFleetProfile), useValue: profileRepo },
        {
          provide: getRepositoryToken(FleetMaintenanceEntry),
          useValue: maintenanceRepo,
        },
        { provide: getRepositoryToken(UnitFleetDocument), useValue: documentsRepo },
        { provide: FleetTenureService, useValue: fleetTenureService },
        { provide: FleetBrandsService, useValue: fleetBrandsService },
        { provide: UnitTripOdometerService, useValue: unitTripOdometer },
        { provide: FleetMaintenanceWorkflowService, useValue: maintenanceWorkflow },
        {
          provide: FleetMaintenanceExpenseSyncService,
          useValue: maintenanceExpenseSync,
        },
        {
          provide: FleetVerificationExpenseSyncService,
          useValue: verificationExpenseSync,
        },
        {
          provide: FleetInsuranceExpenseSyncService,
          useValue: insuranceExpenseSync,
        },
        {
          provide: FleetGpsExpenseSyncService,
          useValue: gpsExpenseSync,
        },
      ],
    }).compile();

    service = module.get(UnitsService);
  });

  it('update rejects status in request body with 400', async () => {
    await expect(
      service.update(1, 7, { status: 'maintenance' } as UpdateUnitDto),
    ).rejects.toThrow(BadRequestException);
    expect(unitRepo.update).not.toHaveBeenCalled();
  });

  it('create rejects status in request body with 400', async () => {
    await expect(
      service.create(1, { plate: 'XYZ', status: 'available' } as never),
    ).rejects.toThrow(BadRequestException);
    expect(unitRepo.save).not.toHaveBeenCalled();
  });

  it('does not mutate operational status when maintenance entries are saved', async () => {
    await service.update(1, 7, {
      fleetMeta: {
        maintenanceEntries: [
          {
            date: '2026-06-01',
            type: 'Aceite',
            cost: 1200,
            status: 'concluido',
          },
        ],
      },
    });

    expect(maintenanceExpenseSync.syncForMaintenanceSave).toHaveBeenCalled();
    expect(unitRepo.update).not.toHaveBeenCalledWith(
      { id: 7, companyId: 1 },
      { status: 'maintenance' },
    );
  });
});
