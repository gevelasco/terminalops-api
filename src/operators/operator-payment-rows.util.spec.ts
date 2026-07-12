import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import { buildOperatorPaymentRows } from './operator-payment-rows.util';

function trip(partial: Partial<Trip> & Pick<Trip, 'id'>): Trip {
  return {
    maneuverCode: 'M-001',
    origin: 'A',
    destination: 'B',
    status: 'completed',
    companyId: 1,
    clientName: 'Cliente',
    operationType: 'full',
    operationConfigurationNameSnapshot: '',
    operationConfigurationVersionSnapshot: 1,
    operationConfigurationMaxEquipmentCountSnapshot: 1,
    loadType: '',
    containerType: '',
    plannedDepartureAt: new Date('2026-06-01T12:00:00Z'),
    plannedArrivalAt: new Date('2026-06-02T12:00:00Z'),
    plannedCompletionAt: new Date('2026-06-03T12:00:00Z'),
    isDelayed: false,
    openIncidentCount: 0,
    creditDays: 0,
    hasIncident: false,
    isRoundTrip: false,
    operatorQuota: '1000',
    operatorId: 5,
    ...partial,
  } as Trip;
}

describe('operator-payment-rows.util', () => {
  it('lists unpaid trips first and paid trips from the last 30 days separately', () => {
    const sections = buildOperatorPaymentRows(
      [
        trip({
          id: 1,
          maneuverCode: 'OLD-UNPAID',
          completedAt: new Date('2026-05-01T12:00:00Z'),
          operatorQuota: '1000',
        }),
        trip({
          id: 2,
          maneuverCode: 'CUR-PAID',
          completedAt: new Date('2026-06-03T12:00:00Z'),
          operatorQuota: '800',
        }),
      ],
      [
        {
          id: 99,
          tripId: 2,
          kind: 'operator_payment',
          amount: '800',
          incurredAt: new Date('2026-06-03T12:00:00Z'),
        } as Expense,
      ],
      'weekly',
      new Date('2026-06-04T12:00:00Z'),
    );

    expect(sections.pendingPaymentRows).toHaveLength(1);
    expect(sections.pendingPaymentRows[0]?.tripId).toBe(1);
    expect(sections.pendingPaymentRows[0]?.canConfirm).toBe(true);
    expect(sections.recentPaymentRows).toHaveLength(1);
    expect(sections.recentPaymentRows[0]?.tripId).toBe(2);
    expect(sections.recentPaymentRows[0]?.status).toBe('paid');
  });

  it('for maneuver schedule keeps unpaid in pending and paid in recent when within 30 days', () => {
    const sections = buildOperatorPaymentRows(
      [
        trip({
          id: 3,
          maneuverCode: 'PAID',
          completedAt: new Date('2026-06-01T12:00:00Z'),
        }),
        trip({
          id: 4,
          maneuverCode: 'OPEN',
          completedAt: new Date('2026-06-02T12:00:00Z'),
          operatorQuota: '500',
        }),
      ],
      [
        {
          id: 10,
          tripId: 3,
          kind: 'operator_payment',
          amount: '1000',
          incurredAt: new Date('2026-06-01T12:00:00Z'),
        } as Expense,
      ],
      'maneuver',
      new Date('2026-06-04T12:00:00Z'),
    );

    expect(sections.pendingPaymentRows).toHaveLength(1);
    expect(sections.pendingPaymentRows[0]?.maneuverCode).toBe('OPEN');
    expect(sections.recentPaymentRows).toHaveLength(1);
    expect(sections.recentPaymentRows[0]?.maneuverCode).toBe('PAID');
  });

  it('for maneuver schedule uses planned completion when lifecycle stamped completedAt later', () => {
    const sections = buildOperatorPaymentRows(
      [
        trip({
          id: 6,
          maneuverCode: 'CG-0002',
          plannedCompletionAt: new Date('2026-06-28T12:00:00Z'),
          completedAt: new Date('2026-07-08T12:00:00Z'),
          operatorQuota: '3000',
        }),
      ],
      [],
      'maneuver',
      new Date('2026-07-08T12:00:00Z'),
    );

    expect(sections.pendingPaymentRows).toHaveLength(1);
    expect(sections.pendingPaymentRows[0]?.dueYmd).toBe('2026-06-28');
    expect(sections.pendingPaymentRows[0]?.status).toBe('overdue');
    expect(sections.pendingPaymentRows[0]?.statusHint).toBe('Vencido');
    expect(sections.pendingPaymentRows[0]?.badgeVariant).toBe('danger');
  });

  it('ignores discarded operator payment expenses when computing balance', () => {
    const sections = buildOperatorPaymentRows(
      [
        trip({
          id: 5,
          maneuverCode: 'AD-00001',
          completedAt: new Date('2026-06-10T12:00:00Z'),
          operatorQuota: '2500',
        }),
      ],
      [
        {
          id: 20,
          tripId: 5,
          kind: 'operator_payment',
          amount: '2500',
          incurredAt: new Date('2026-06-10T12:00:00Z'),
          discardedAt: new Date('2026-06-11T12:00:00Z'),
        } as Expense,
      ],
      'maneuver',
      new Date('2026-06-20T12:00:00Z'),
    );

    expect(sections.pendingPaymentRows).toHaveLength(1);
    expect(sections.pendingPaymentRows[0]?.maneuverCode).toBe('AD-00001');
    expect(sections.pendingPaymentRows[0]?.canConfirm).toBe(true);
    expect(sections.recentPaymentRows).toHaveLength(0);
  });
});
