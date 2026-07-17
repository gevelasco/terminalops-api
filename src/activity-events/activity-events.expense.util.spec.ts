import type { Expense } from 'src/expenses/entities/expense.entity';
import { COMPANY_ACTIVITY_KIND } from './company-activity-event.kinds';
import { expenseActivityOnUpdate } from './activity-events.expense.util';

function expense(
  kind: string,
  paidAt: Date | null,
): Expense {
  return {
    kind,
    paidAt,
    discardedAt: null,
  } as Expense;
}

describe('expenseActivityOnUpdate', () => {
  it('describes a scheduled payment confirmation', () => {
    expect(
      expenseActivityOnUpdate(
        expense('insurance', new Date('2026-07-16T12:00:00.000Z')),
        expense('insurance', null),
      ),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED,
      title: 'Pago de seguro confirmado',
    });
  });

  it('describes removal of a tenure payment confirmation', () => {
    expect(
      expenseActivityOnUpdate(
        expense('tenure_payment', null),
        expense('tenure_payment', new Date('2026-07-16T12:00:00.000Z')),
      ),
    ).toEqual({
      kind: COMPANY_ACTIVITY_KIND.PAYMENT_REVERTED,
      title: 'Confirmación de cuota removida',
    });
  });
});
