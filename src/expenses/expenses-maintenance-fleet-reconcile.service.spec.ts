import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ExpensesMaintenanceFleetReconcileService } from './expenses-maintenance-fleet-reconcile.service';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';

describe('ExpensesMaintenanceFleetReconcileService', () => {
  let service: ExpensesMaintenanceFleetReconcileService;

  const maintenanceFind = jest.fn();
  const maintenanceDelete = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    maintenanceFind.mockResolvedValue([]);
    maintenanceDelete.mockResolvedValue(undefined);

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
      ],
    }).compile();

    service = module.get(ExpensesMaintenanceFleetReconcileService);
  });

  it('deletes matching maintenance entry without updating profile', async () => {
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
      relatedUnitId: 7,
      category: 'Aceite',
      amount: '1200',
      description: 'Taller',
      incurredAt: new Date('2026-06-01T12:00:00.000Z'),
    } as Expense);

    expect(maintenanceDelete).toHaveBeenCalledWith({ id: 11 });
    expect(maintenanceDelete).toHaveBeenCalledTimes(1);
  });
});
