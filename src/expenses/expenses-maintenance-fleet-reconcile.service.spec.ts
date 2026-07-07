import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ExpensesMaintenanceFleetReconcileService } from './expenses-maintenance-fleet-reconcile.service';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';

describe('ExpensesMaintenanceFleetReconcileService', () => {
  let service: ExpensesMaintenanceFleetReconcileService;

  const maintenanceFind = jest.fn();
  const maintenanceDelete = jest.fn();
  const unitProfileFindOne = jest.fn();
  const unitProfileUpdate = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    maintenanceFind.mockResolvedValue([]);
    maintenanceDelete.mockResolvedValue(undefined);
    unitProfileFindOne.mockResolvedValue({ unitId: 7 });
    unitProfileUpdate.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesMaintenanceFleetReconcileService,
        {
          provide: getRepositoryToken(Expense),
          useValue: {},
        },
        {
          provide: getRepositoryToken(FleetMaintenanceEntry),
          useValue: {
            find: maintenanceFind,
            delete: maintenanceDelete,
          },
        },
        {
          provide: getRepositoryToken(UnitFleetProfile),
          useValue: {
            findOne: unitProfileFindOne,
            update: unitProfileUpdate,
          },
        },
        {
          provide: getRepositoryToken(EquipmentFleetProfile),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ExpensesMaintenanceFleetReconcileService);
  });

  it('deletes matching maintenance entry and recomputes profile fields', async () => {
    maintenanceFind.mockResolvedValueOnce([
      {
        id: 11,
        entryDate: '2026-06-01',
        entryType: 'Aceite',
        cost: '1200',
        notes: 'Taller',
      },
      {
        id: 12,
        entryDate: '2026-05-01',
        entryType: 'Frenos',
        cost: '800',
      },
    ]);

    await service.reconcileAfterMaintenanceExpenseDiscard({
      kind: 'maintenance',
      maintenanceTarget: 'unit',
      relatedUnitId: 7,
      category: 'Aceite',
      amount: '1200',
      description: 'Taller',
      incurredAt: new Date('2026-06-01T12:00:00.000Z'),
    } as Expense);

    expect(maintenanceDelete).toHaveBeenCalledWith({ id: 11 });
    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      {
        lastMaintenanceDate: '2026-05-01',
        lastMaintenanceType: 'Frenos',
        lastMaintenanceCost: '800',
        lastMaintenanceNotes: null,
      },
    );
  });
});
