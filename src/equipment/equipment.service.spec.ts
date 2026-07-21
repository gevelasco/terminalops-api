import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FleetBrandsService } from 'src/fleet/fleet-brands.service';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { EquipmentFleetDocument } from './entities/equipment-fleet-document.entity';
import { EquipmentFleetProfile } from './entities/equipment-fleet-profile.entity';
import { Equipment } from './entities/equipment.entity';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';
import { FleetMaintenanceWorkflowService } from 'src/fleet/fleet-maintenance-workflow.service';
import { FleetMaintenanceExpenseSyncService } from 'src/fleet/fleet-maintenance-expense-sync.service';
import { FleetVerificationExpenseSyncService } from 'src/fleet/fleet-verification-expense-sync.service';
import { FleetInsuranceExpenseSyncService } from 'src/fleet/fleet-insurance-expense-sync.service';
import { FleetTenureExpenseSyncService } from 'src/fleet/fleet-tenure-expense-sync.service';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';

describe('EquipmentService (A6 fleet status lock)', () => {
  let service: EquipmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EquipmentService,
        {
          provide: getRepositoryToken(Equipment),
          useValue: { findOne: jest.fn(), update: jest.fn(), save: jest.fn() },
        },
        { provide: getRepositoryToken(Unit), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(EquipmentFleetProfile),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FleetMaintenanceEntry),
          useValue: { find: jest.fn(), delete: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(FleetVerificationEntry),
          useValue: { find: jest.fn(), delete: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(EquipmentFleetDocument),
          useValue: { delete: jest.fn(), save: jest.fn() },
        },
        {
          provide: FleetTenureService,
          useValue: { findByEquipment: jest.fn(), upsertFromFleetMeta: jest.fn() },
        },
        {
          provide: FleetBrandsService,
          useValue: { findOrCreateBrand: jest.fn(), findOrCreateVersion: jest.fn() },
        },
        {
          provide: FleetMaintenanceWorkflowService,
          useValue: {
            startEquipmentMaintenance: jest.fn(),
            endEquipmentMaintenance: jest.fn(),
          },
        },
        {
          provide: FleetMaintenanceExpenseSyncService,
          useValue: { syncForMaintenanceSave: jest.fn() },
        },
        {
          provide: FleetVerificationExpenseSyncService,
          useValue: { syncForUnitVerificationSave: jest.fn() },
        },
        {
          provide: FleetInsuranceExpenseSyncService,
          useValue: {
            syncForInsurancePaymentSave: jest.fn(),
            ensureInitialInsurancePremium: jest.fn(),
            ensureAllInsuranceInstallments: jest.fn(),
          },
        },
        {
          provide: FleetTenureExpenseSyncService,
          useValue: { ensureAllTenureInstallments: jest.fn() },
        },
        {
          provide: ActivityEventsService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(EquipmentService);
  });

  it('update rejects status in request body with 400', async () => {
    await expect(
      service.update(1, 2, { status: 'maintenance' } as UpdateEquipmentDto),
    ).rejects.toThrow(BadRequestException);
  });

  it('create rejects status in request body with 400', async () => {
    await expect(
      service.create(1, {
        name: 'Trailer',
        serialNumber: 'SN-1',
        status: 'available',
      } as never),
    ).rejects.toThrow(BadRequestException);
  });
});
