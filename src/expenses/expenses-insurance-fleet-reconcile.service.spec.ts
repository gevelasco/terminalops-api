import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ExpensesInsuranceFleetReconcileService } from './expenses-insurance-fleet-reconcile.service';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';

describe('ExpensesInsuranceFleetReconcileService', () => {
  let service: ExpensesInsuranceFleetReconcileService;

  const expenseGetMany = jest.fn();
  const unitProfileFindOne = jest.fn();
  const unitProfileUpdate = jest.fn();
  const equipmentProfileFindOne = jest.fn();
  const equipmentProfileUpdate = jest.fn();

  const expenseQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: expenseGetMany,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    expenseGetMany.mockResolvedValue([]);
    unitProfileFindOne.mockResolvedValue({
      unitId: 7,
      insuranceContractDate: '2026-06-01',
      insurancePaymentCadence: 'Mensual',
    });
    unitProfileUpdate.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesInsuranceFleetReconcileService,
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
      ],
    }).compile();

    service = module.get(ExpensesInsuranceFleetReconcileService);
  });

  it('clears unit insuranceLastPaymentDate when no payment expenses remain', async () => {
    await service.reconcileAfterInsuranceExpenseDiscard({
      kind: 'insurance',
      insuranceTarget: 'unit',
      relatedUnitId: 7,
    } as Expense);

    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      { insuranceLastPaymentDate: null },
    );
  });

  it('sets unit insuranceLastPaymentDate to cycle due date from installment', async () => {
    expenseGetMany.mockResolvedValueOnce([
      {
        incurredAt: new Date('2026-07-05T18:00:00.000Z'),
        description: 'Pago de póliza · ABC (Mensualidad 2/12)',
      },
    ]);

    await service.reconcileAfterInsuranceExpenseDiscard({
      kind: 'insurance',
      insuranceTarget: 'unit',
      relatedUnitId: 7,
    } as Expense);

    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      { insuranceLastPaymentDate: '2026-07-01' },
    );
  });

  it('moves last payment date back to previous installment when latest was deleted', async () => {
    expenseGetMany.mockResolvedValueOnce([
      {
        incurredAt: new Date('2026-07-05T18:00:00.000Z'),
        description: 'Pago de póliza · ABC (Mensualidad 1/12)',
      },
    ]);

    await service.reconcileAfterInsuranceExpenseDiscard({
      kind: 'insurance',
      insuranceTarget: 'unit',
      relatedUnitId: 7,
      description: 'Pago de póliza · ABC (Mensualidad 2/12)',
      incurredAt: new Date('2026-07-05T18:00:00.000Z'),
    } as Expense);

    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      { insuranceLastPaymentDate: '2026-06-01' },
    );
  });

  it('clears unit gpsLastPaymentDate when no payment expenses remain', async () => {
    unitProfileFindOne.mockResolvedValueOnce({
      unitId: 7,
      gpsContractDate: '2026-06-01',
      gpsPaymentCadence: 'Mensual',
    });

    await service.reconcileAfterGpsExpenseDiscard({
      kind: 'gps',
      relatedUnitId: 7,
    } as Expense);

    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      { gpsLastPaymentDate: null },
    );
  });

  it('sets unit gpsLastPaymentDate to cycle due date from installment', async () => {
    unitProfileFindOne.mockResolvedValueOnce({
      unitId: 7,
      gpsContractDate: '2026-06-01',
      gpsPaymentCadence: 'Mensual',
    });
    expenseGetMany.mockResolvedValueOnce([
      {
        incurredAt: new Date('2026-07-05T18:00:00.000Z'),
        description: 'Pago de GPS · SkyBitz (Mensualidad 2/12)',
      },
    ]);

    await service.reconcileAfterGpsExpenseDiscard({
      kind: 'gps',
      relatedUnitId: 7,
    } as Expense);

    expect(unitProfileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      { gpsLastPaymentDate: '2026-07-01' },
    );
  });
});
