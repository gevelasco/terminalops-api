import type { Expense } from 'src/expenses/entities/expense.entity';
import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';
import {
  expenseActivityOnCreate,
  expenseActivityOnUpdate,
} from './activity-events.expense.util';

function expense(
  kind: string,
  paidAt: Date | null,
  extra: Partial<Expense> = {},
): Expense {
  return {
    kind,
    paidAt,
    discardedAt: null,
    ...extra,
  } as Expense;
}

describe('expenseActivityOnUpdate', () => {
  it('describes a scheduled payment confirmation', () => {
    expect(
      expenseActivityOnUpdate(
        expense('insurance', new Date('2026-07-16T12:00:00.000Z'), {
          relatedUnitId: 4,
        }),
        expense('insurance', null, { relatedUnitId: 4 }),
      ),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED,
      title: 'Pago de seguro confirmado',
      entityType: 'unit',
      entityId: 4,
    });
  });

  it('points a GPS confirmation at the unit even if only the relation is loaded', () => {
    expect(
      expenseActivityOnUpdate(
        expense('gps', new Date('2026-08-28T12:00:00.000Z'), {
          relatedUnit: { id: 7 } as Expense['relatedUnit'],
        }),
        expense('gps', null),
      ),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED,
      title: 'Pago de GPS confirmado',
      entityType: 'unit',
      entityId: 7,
    });
  });

  it('describes removal of a tenure payment confirmation', () => {
    expect(
      expenseActivityOnUpdate(
        expense('tenure_payment', null, { relatedUnitId: 4 }),
        expense('tenure_payment', new Date('2026-07-16T12:00:00.000Z'), {
          relatedUnitId: 4,
        }),
      ),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_REVERTED,
      title: 'Confirmación de cuota removida',
      entityType: 'unit',
      entityId: 4,
    });
  });
});

describe('expenseActivityOnCreate', () => {
  it('labels a trip-linked expense as added to the maneuver', () => {
    expect(
      expenseActivityOnCreate(expense('fuel', null, { tripId: 42 })),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.TRIP_EXPENSE_ADDED,
      title: 'Gasto agregado',
      entityType: 'trip',
      entityId: 42,
    });
  });

  it('keeps standalone manual expenses as registered', () => {
    expect(expenseActivityOnCreate(expense('other', null))).toEqual({
      kind: COMPANY_ACTIVITY_KIND.EXPENSE_MANUAL_CREATED,
      title: 'Gasto registrado',
    });
  });

  it('does not treat an unpaid verification ledger row as a confirmed payment', () => {
    expect(
      expenseActivityOnCreate(
        expense('verification', null, { relatedUnitId: 7 }),
      ),
    ).toBeNull();
  });

  it('labels a paid coverage expense with the related unit', () => {
    expect(
      expenseActivityOnCreate(
        expense('verification', new Date('2026-08-28T12:00:00.000Z'), {
          relatedUnitId: 7,
        }),
      ),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.COVERAGE_PAYMENT_CONFIRMED,
      title: 'Pago de verificación confirmado',
      entityType: 'unit',
      entityId: 7,
    });
  });
});
