import type { Expense } from 'src/expenses/entities/expense.entity';
import { buildPayableItems } from './reports-payable-items.util';

function expense(partial: Partial<Expense>): Expense {
  return {
    id: 1,
    companyId: 1,
    category: 'Póliza',
    amount: '10000',
    currency: 'MXN',
    kind: 'insurance',
    ...partial,
  } as Expense;
}

describe('buildPayableItems', () => {
  const today = '2026-08-27';
  const to = '2026-08-31';

  it('includes remaining dues in the period and overdue unpaid', () => {
    const items = buildPayableItems({
      today,
      to,
      expenses: [
        expense({
          id: 1,
          description: 'Seguro 10 ago',
          incurredAt: new Date('2026-08-10T18:00:00.000Z'),
          paidAt: null,
        }),
        expense({
          id: 2,
          description: 'Seguro 30 ago',
          incurredAt: new Date('2026-08-30T18:00:00.000Z'),
          paidAt: null,
        }),
        expense({
          id: 3,
          description: 'Seguro ya pagado',
          incurredAt: new Date('2026-08-28T18:00:00.000Z'),
          paidAt: new Date('2026-08-28T18:00:00.000Z'),
        }),
        expense({
          id: 4,
          description: 'Septiembre',
          incurredAt: new Date('2026-09-10T18:00:00.000Z'),
          paidAt: null,
        }),
      ],
    });

    expect(items.map((row) => row.description)).toEqual([
      'Seguro 10 ago',
      'Seguro 30 ago',
    ]);
    expect(items[0]?.status).toBe('overdue');
    expect(items[1]?.status).toBe('pending');
  });

  it('keeps overdue from before the period start', () => {
    const items = buildPayableItems({
      today,
      to,
      expenses: [
        expense({
          description: 'Julio vencido',
          incurredAt: new Date('2026-07-10T18:00:00.000Z'),
          paidAt: null,
        }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('overdue');
  });

  it('keeps a due today as pending until it is confirmed', () => {
    const items = buildPayableItems({
      today: '2026-08-15',
      to: '2026-08-31',
      expenses: [
        expense({
          description: 'GPS 15 ago',
          incurredAt: new Date('2026-08-15T18:00:00.000Z'),
          paidAt: null,
        }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe('pending');
  });
});
