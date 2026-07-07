import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesInsuranceFleetReconcileService } from './expenses-insurance-fleet-reconcile.service';
import { ExpensesMaintenanceFleetReconcileService } from './expenses-maintenance-fleet-reconcile.service';
import { ExpensesVerificationFleetReconcileService } from './expenses-verification-fleet-reconcile.service';

describe('ExpensesService (A2)', () => {
  let service: ExpensesService;

  const expenseSave = jest.fn();
  const expenseCreate = jest.fn((dto: object) => dto);
  const expenseUpdate = jest.fn();
  const expenseFindOne = jest.fn();

  const tripsFindOne = jest.fn();
  const unitsFindOne = jest.fn();
  const equipmentFindOne = jest.fn();
  const operatorsFindOne = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    expenseSave.mockImplementation(async (row: Expense | Expense[]) => {
      const one = Array.isArray(row) ? row[0] : row;
      return { ...one, id: one.id ?? 42 };
    });
    expenseFindOne.mockImplementation(async (opts: { where: { id: number } }) => {
      const id = opts.where.id;
      return {
        id,
        companyId: 1,
        category: 'Servicio',
        amount: '100.00',
        currency: 'MXN',
        incurredAt: new Date('2025-06-01T12:00:00.000Z'),
        kind: 'maintenance',
        vendor: 'Taller Norte',
        paymentMethod: 'transfer',
        maintenanceTarget: 'unit',
        insuranceTarget: null,
        verificationScope: null,
        relatedUnitId: 7,
        trip: { id: 10, maneuverCode: 'ADM-0001' },
        relatedUnit: { id: 7 },
      } as Expense;
    });

    unitsFindOne.mockResolvedValue({ id: 7 });
    equipmentFindOne.mockResolvedValue({ id: 9 });
    tripsFindOne.mockResolvedValue({ id: 10 });
    operatorsFindOne.mockResolvedValue({ id: 3 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: ExpensesInsuranceFleetReconcileService,
          useValue: {
            reconcileAfterInsuranceExpenseDiscard: jest.fn(),
            reconcileAfterGpsExpenseDiscard: jest.fn(),
          },
        },
        {
          provide: ExpensesMaintenanceFleetReconcileService,
          useValue: { reconcileAfterMaintenanceExpenseDiscard: jest.fn() },
        },
        {
          provide: ExpensesVerificationFleetReconcileService,
          useValue: { reconcileAfterVerificationExpenseDiscard: jest.fn() },
        },
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            save: expenseSave,
            create: expenseCreate,
            update: expenseUpdate,
            findOne: expenseFindOne,
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Trip),
          useValue: { findOne: tripsFindOne },
        },
        {
          provide: getRepositoryToken(Unit),
          useValue: { findOne: unitsFindOne },
        },
        {
          provide: getRepositoryToken(Equipment),
          useValue: { findOne: equipmentFindOne },
        },
        {
          provide: getRepositoryToken(Operator),
          useValue: { findOne: operatorsFindOne },
        },
      ],
    }).compile();

    service = module.get(ExpensesService);
  });

  it('create persists vendor, paymentMethod and maintenanceTarget (round-trip)', async () => {
    const result = await service.create(1, {
      category: 'Aceite',
      amount: 1500,
      incurredAt: '2025-06-02',
      kind: 'maintenance',
      maintenanceTarget: 'unit',
      relatedUnitId: '7',
      vendor: '  Taller AC ',
      paymentMethod: 'cash',
    });

    expect(expenseSave).toHaveBeenCalledTimes(1);
    const payload = expenseCreate.mock.calls[0][0];
    expect(payload.vendor).toBe('Taller AC');
    expect(payload.paymentMethod).toBe('cash');
    expect(payload.maintenanceTarget).toBe('unit');
    expect(payload.insuranceTarget).toBeNull();
    expect(payload.verificationScope).toBeNull();
    expect(payload.incurredAt.toISOString()).toBe('2025-06-02T18:00:00.000Z');
    expect(result.vendor).toBe('Taller Norte');
    expect(result.paymentMethod).toBe('transfer');
  });

  it('create rejects maintenance without maintenanceTarget', async () => {
    await expect(
      service.create(1, {
        category: 'Aceite',
        amount: 100,
        incurredAt: '2025-06-02',
        kind: 'maintenance',
        relatedUnitId: '7',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(expenseSave).not.toHaveBeenCalled();
  });

  it('update persists vendor and paymentMethod (round-trip)', async () => {
    expenseFindOne.mockResolvedValueOnce({
      id: 42,
      companyId: 1,
      kind: 'fuel',
      maintenanceTarget: null,
      insuranceTarget: null,
      verificationScope: null,
      relatedUnitId: null,
      relatedEquipmentId: null,
    });

    await service.update(1, 42, {
      vendor: 'Gasolinera 1',
      paymentMethod: 'credit',
    });

    expect(expenseUpdate).toHaveBeenCalledWith(
      { id: 42, companyId: 1 },
      expect.objectContaining({
        vendor: 'Gasolinera 1',
        paymentMethod: 'credit',
        maintenanceTarget: null,
        insuranceTarget: null,
        verificationScope: null,
      }),
    );
  });

  it('update clears targets when kind changes to fuel', async () => {
    expenseFindOne.mockResolvedValueOnce({
      id: 42,
      companyId: 1,
      kind: 'maintenance',
      maintenanceTarget: 'unit',
      insuranceTarget: null,
      verificationScope: null,
      relatedUnitId: 7,
      relatedEquipmentId: null,
    });

    await service.update(1, 42, { kind: 'fuel' });

    expect(expenseUpdate).toHaveBeenCalledWith(
      { id: 42, companyId: 1 },
      expect.objectContaining({
        kind: 'fuel',
        maintenanceTarget: null,
        insuranceTarget: null,
        verificationScope: null,
      }),
    );
  });

  it('createAutoExpensesForTrip does not set A2 relation fields', async () => {
    await service.createAutoExpensesForTrip(1, {
      id: 99,
      maneuverCode: 'ADM-0099',
      companyId: 1,
      clientCharge: '5000',
      dieselAmount: '1000',
      casetasAmount: '200',
      operatorQuota: '800',
      unitId: 7,
      operatorId: 3,
      plannedDepartureAt: new Date('2025-06-03T08:00:00.000Z'),
      createdAt: new Date('2025-06-01T12:00:00.000Z'),
    } as Trip);

    expect(expenseSave).toHaveBeenCalledTimes(1);
    const rows = expenseCreate.mock.calls.map((c) => c[0]);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.vendor).toBeUndefined();
      expect(row.paymentMethod).toBeUndefined();
      expect(row.maintenanceTarget).toBeUndefined();
      expect(row.insuranceTarget).toBeUndefined();
      expect(row.verificationScope).toBeUndefined();
    }
  });

  it('update throws when expense not found', async () => {
    expenseFindOne.mockResolvedValueOnce(null);
    await expect(service.update(1, 999, { vendor: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove soft-deletes expense for admin', async () => {
    expenseFindOne.mockResolvedValueOnce({
      id: 42,
      companyId: 1,
      discardedAt: null,
    } as Expense);

    await expect(
      service.remove(1, 42, { role: 'admin' } as never),
    ).resolves.toEqual({ id: 42, deleted: true });
    expect(expenseUpdate).toHaveBeenCalledWith(
      { id: 42, companyId: 1 },
      expect.objectContaining({ discardedAt: expect.any(Date) }),
    );
  });

  it('remove rejects non-admin users', async () => {
    await expect(
      service.remove(1, 42, { role: 'staff' } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
