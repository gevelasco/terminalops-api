import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ExpensesVerificationFleetReconcileService } from './expenses-verification-fleet-reconcile.service';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';

describe('ExpensesVerificationFleetReconcileService', () => {
  let service: ExpensesVerificationFleetReconcileService;

  const expenseGetOne = jest.fn();
  const unitProfileFindOne = jest.fn();
  const unitProfileUpdate = jest.fn();
  const equipmentProfileFindOne = jest.fn();
  const equipmentProfileUpdate = jest.fn();
  const equipmentFind = jest.fn();

  const expenseQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: expenseGetOne,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    expenseGetOne.mockResolvedValue(null);
    unitProfileFindOne.mockResolvedValue({
      unitId: 7,
      verificationPhysMechDate: '2026-06-01',
      verificationPhysMechCost: '900',
    });
    unitProfileUpdate.mockResolvedValue(undefined);
    equipmentFind.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesVerificationFleetReconcileService,
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            createQueryBuilder: jest.fn(() => expenseQb),
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
            findOne: equipmentProfileFindOne,
            update: equipmentProfileUpdate,
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

  it('clears unit verification fields when no verification expenses remain', async () => {
    await service.reconcileAfterVerificationExpenseDiscard({
      companyId: 1,
      kind: 'verification',
      verificationScope: 'phys_mech',
      relatedUnitId: 7,
      incurredAt: new Date('2026-06-01T18:00:00.000Z'),
    } as Expense);

    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      {
        verificationPhysMechDate: null,
        verificationPhysMechCost: null,
      },
    );
  });

  it('reverts unit verification to the previous expense when an older payment remains', async () => {
    expenseGetOne.mockResolvedValueOnce({
      incurredAt: new Date('2025-12-01T18:00:00.000Z'),
      amount: '800',
    });

    await service.reconcileAfterVerificationExpenseDiscard({
      companyId: 1,
      kind: 'verification',
      verificationScope: 'phys_mech',
      relatedUnitId: 7,
      incurredAt: new Date('2026-06-01T18:00:00.000Z'),
    } as Expense);

    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      {
        verificationPhysMechDate: '2025-12-01',
        verificationPhysMechCost: '800',
      },
    );
  });

  it('skips unit reconcile when discarded expense does not match current profile date', async () => {
    unitProfileFindOne.mockResolvedValueOnce({
      unitId: 7,
      verificationPhysMechDate: '2026-07-01',
    });

    await service.reconcileAfterVerificationExpenseDiscard({
      companyId: 1,
      kind: 'verification',
      verificationScope: 'phys_mech',
      relatedUnitId: 7,
      incurredAt: new Date('2026-06-01T18:00:00.000Z'),
    } as Expense);

    expect(unitProfileUpdate).not.toHaveBeenCalled();
  });
});
