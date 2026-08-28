import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import { buildOperatorPaymentRows } from './operator-payment-rows.util';

function trip(partial: Partial<Trip> & Pick<Trip, 'id'>): Trip {
  return {
    maneuverCode: 'M-001',
    originLocality: 'A',
    destinationLocality: 'B',
    status: 'completed',
    companyId: 1,
    clientName: 'Cliente',
    operationType: 'full',
    loadType: '',
    containerType: '',
    plannedDepartureAt: new Date('2026-06-01T12:00:00Z'),
    plannedArrivalAt: new Date('2026-06-02T12:00:00Z'),
    plannedCompletionAt: new Date('2026-06-03T12:00:00Z'),
    creditDays: 0,
    hasIncident: false,
    operatorQuota: '1000',
    operatorId: 5,
    ...partial,
  } as Trip;
}

function expense(partial: Partial<Expense>): Expense {
  return {
    id: 1,
    companyId: 1,
    category: 'Pago a operador',
    amount: '1000',
    currency: 'MXN',
    kind: 'operator_payment',
    discardedAt: null,
    ...partial,
  } as Expense;
}

describe('operator-payment-rows.util', () => {
  it('lists unpaid ledger rows as pending and paid rows from the last 30 days as recent', () => {
    const sections = buildOperatorPaymentRows(
      [
        trip({ id: 1, maneuverCode: 'OLD-UNPAID', completedAt: new Date('2026-05-01T18:00:00Z') }),
        trip({ id: 2, maneuverCode: 'CUR-PAID', completedAt: new Date('2026-06-03T18:00:00Z') }),
      ],
      [
        expense({
          id: 1,
          tripId: 1,
          amount: '1000',
          incurredAt: new Date('2026-05-01T18:00:00Z'),
          paidAt: null,
        }),
        expense({
          id: 99,
          tripId: 2,
          amount: '800',
          incurredAt: new Date('2026-06-03T18:00:00Z'),
          paidAt: new Date('2026-06-03T18:00:00Z'),
        }),
      ],
      new Date('2026-06-04T18:00:00Z'),
    );

    expect(sections.pendingPaymentRows).toHaveLength(1);
    expect(sections.pendingPaymentRows[0]?.tripId).toBe(1);
    expect(sections.pendingPaymentRows[0]?.canConfirm).toBe(true);
    expect(sections.recentPaymentRows).toHaveLength(1);
    expect(sections.recentPaymentRows[0]?.tripId).toBe(2);
    expect(sections.recentPaymentRows[0]?.status).toBe('paid');
  });

  it('does not invent a pending payment from quota when the ledger has no row', () => {
    const sections = buildOperatorPaymentRows(
      [
        trip({
          id: 6,
          maneuverCode: 'CG-0002',
          plannedCompletionAt: new Date('2026-06-28T18:00:00Z'),
          completedAt: new Date('2026-07-08T18:00:00Z'),
          operatorQuota: '3000',
        }),
      ],
      [],
      new Date('2026-07-08T18:00:00Z'),
    );

    expect(sections.pendingPaymentRows).toHaveLength(0);
    expect(sections.recentPaymentRows).toHaveLength(0);
  });

  it('uses the ledger due date and ignores discarded expenses', () => {
    const sections = buildOperatorPaymentRows(
      [
        trip({
          id: 5,
          maneuverCode: 'AD-00001',
          completedAt: new Date('2026-06-10T18:00:00Z'),
        }),
      ],
      [
        expense({
          id: 20,
          tripId: 5,
          amount: '2500',
          incurredAt: new Date('2026-06-10T18:00:00Z'),
          discardedAt: new Date('2026-06-11T18:00:00Z'),
        }),
        expense({
          id: 21,
          tripId: 5,
          amount: '2500',
          incurredAt: new Date('2026-06-12T18:00:00Z'),
          paidAt: null,
        }),
      ],
      new Date('2026-06-20T18:00:00Z'),
    );

    expect(sections.pendingPaymentRows).toHaveLength(1);
    expect(sections.pendingPaymentRows[0]?.expenseId).toBe(21);
    expect(sections.pendingPaymentRows[0]?.dueYmd).toBe('2026-06-12');
    expect(sections.pendingPaymentRows[0]?.status).toBe('overdue');
    expect(sections.recentPaymentRows).toHaveLength(0);
  });
});
