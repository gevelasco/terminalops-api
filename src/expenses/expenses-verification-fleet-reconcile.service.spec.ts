import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ExpensesVerificationFleetReconcileService } from './expenses-verification-fleet-reconcile.service';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';

describe('ExpensesVerificationFleetReconcileService', () => {
  let service: ExpensesVerificationFleetReconcileService;

  const verificationFind = jest.fn();
  const verificationDelete = jest.fn();
  const equipmentFind = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    verificationFind.mockResolvedValue([]);
    verificationDelete.mockResolvedValue(undefined);
    equipmentFind.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesVerificationFleetReconcileService,
        {
          provide: getRepositoryToken(Expense),
          useValue: {},
        },
        {
          provide: getRepositoryToken(FleetVerificationEntry),
          useValue: {
            find: verificationFind,
            delete: verificationDelete,
          },
        },
        {
          provide: getRepositoryToken(Equipment),
          useValue: {
            find: equipmentFind,
          },
        },
      ],
    }).compile();

    service = module.get(ExpensesVerificationFleetReconcileService);
  });

  it('deletes matching unit verification entry by scope and date', async () => {
    verificationFind.mockResolvedValueOnce([
      {
        id: 21,
        scope: 'phys_mech',
        entryDate: '2026-06-01',
        cost: '900',
      },
    ]);

    await service.reconcileAfterVerificationExpenseDiscard({
      companyId: 1,
      kind: 'verification',
      category: 'Verificación - físico-mecánica',
      relatedUnitId: 7,
      incurredAt: new Date('2026-06-01T18:00:00.000Z'),
    } as Expense);

    expect(verificationDelete).toHaveBeenCalledWith({ id: 21 });
  });

  it('skips reconcile when no entry matches discarded date', async () => {
    verificationFind.mockResolvedValueOnce([
      {
        id: 21,
        scope: 'phys_mech',
        entryDate: '2026-07-01',
      },
    ]);

    await service.reconcileAfterVerificationExpenseDiscard({
      companyId: 1,
      kind: 'verification',
      category: 'Verificación - físico-mecánica',
      relatedUnitId: 7,
      incurredAt: new Date('2026-06-01T18:00:00.000Z'),
    } as Expense);

    expect(verificationDelete).not.toHaveBeenCalled();
  });
});
