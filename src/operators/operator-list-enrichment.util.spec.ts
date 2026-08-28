import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import {
  buildNextPayDueByOperatorId,
  buildOperatorLastManeuverSnapshot,
} from './operator-list-enrichment.util';

function trip(partial: Partial<Trip> & Pick<Trip, 'id' | 'operatorId'>): Trip {
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
    plannedDepartureAt: new Date('2026-01-01T12:00:00Z'),
    plannedArrivalAt: new Date('2026-01-02T12:00:00Z'),
    plannedCompletionAt: new Date('2026-01-03T12:00:00Z'),
    creditDays: 0,
    hasIncident: false,
    ...partial,
  } as Trip;
}

describe('operator-list-enrichment.util', () => {
  it('buildOperatorLastManeuverSnapshot uses completedAt for occurredOn', () => {
    const snap = buildOperatorLastManeuverSnapshot(
      trip({
        id: 10,
        operatorId: 2,
        completedAt: new Date('2026-03-10T15:00:00Z'),
      }),
    );
    expect(snap.maneuverCode).toBe('M-001');
    expect(snap.occurredOn).toBe('2026-03-10');
  });

  it('buildOperatorLastManeuverSnapshot prefers returnAt over completedAt', () => {
    const snap = buildOperatorLastManeuverSnapshot(
      trip({
        id: 12,
        operatorId: 2,
        returnAt: new Date('2026-08-10T15:00:00Z'),
        completedAt: new Date('2026-08-12T15:00:00Z'),
      }),
    );
    expect(snap.occurredOn).toBe('2026-08-10');
  });

  it('buildOperatorLastManeuverSnapshot omits locality from route labels', () => {
    const snap = buildOperatorLastManeuverSnapshot(
      trip({
        id: 11,
        operatorId: 2,
        originLocality: 'Barrio 5',
        originCityMunicipality: 'Manzanillo, Colima',
        originPostalCode: '28219',
        destinationLocality: 'Loma de Canteras (Lomas de Cantera)',
        destinationCityMunicipality: 'Naucalpan de Juárez, México',
        destinationPostalCode: '53470',
        completedAt: new Date('2026-07-23T15:00:00Z'),
      }),
    );
    expect(snap.origin).toBe('Manzanillo, Colima · 28219');
    expect(snap.destination).toBe('Naucalpan de Juárez, México · 53470');
  });

  it('buildNextPayDueByOperatorId uses unpaid ledger rows, not trip quota', () => {
    const trips = [
      trip({
        id: 1,
        operatorId: 5,
        operatorQuota: '1000',
        returnAt: new Date('2026-03-01T18:00:00Z'),
      }),
      trip({
        id: 2,
        operatorId: 5,
        operatorQuota: '800',
        returnAt: new Date('2026-02-20T18:00:00Z'),
      }),
    ];
    const expenses: Expense[] = [
      {
        id: 11,
        tripId: 1,
        relatedOperatorId: 5,
        kind: 'operator_payment',
        amount: '1000',
        incurredAt: new Date('2026-03-01T18:00:00Z'),
        paidAt: null,
        discardedAt: null,
      } as Expense,
      {
        id: 12,
        tripId: 2,
        relatedOperatorId: 5,
        kind: 'operator_payment',
        amount: '800',
        incurredAt: new Date('2026-02-20T18:00:00Z'),
        paidAt: null,
        discardedAt: null,
      } as Expense,
    ];
    const map = buildNextPayDueByOperatorId(
      trips,
      expenses,
      new Date('2026-03-05T18:00:00Z'),
    );
    expect(map.get(5)?.dueOn).toBe('2026-02-20');
    expect(map.get(5)?.variant).toBe('danger');
    expect(map.get(5)?.owedAmount).toBe(1800);
  });

  it('buildNextPayDueByOperatorId ignores quota when the ledger has no pending row', () => {
    const trips = [
      trip({
        id: 3,
        operatorId: 5,
        operatorQuota: '2500',
        plannedCompletionAt: new Date('2026-06-04T18:00:00Z'),
      }),
    ];
    const map = buildNextPayDueByOperatorId(
      trips,
      [],
      new Date('2026-06-17T18:00:00Z'),
    );
    expect(map.get(5)).toBeUndefined();
  });

  it('buildNextPayDueByOperatorId uses the earliest unpaid ledger due date', () => {
    const trips = [
      trip({
        id: 4,
        operatorId: 1,
        operatorQuota: '2500',
        returnAt: new Date('2026-03-03T18:00:00Z'),
      }),
    ];
    const map = buildNextPayDueByOperatorId(
      trips,
      [
        {
          id: 20,
          tripId: 4,
          relatedOperatorId: 1,
          kind: 'operator_payment',
          amount: '2500',
          incurredAt: new Date('2026-03-07T18:00:00Z'),
          paidAt: null,
          discardedAt: null,
        } as Expense,
      ],
      new Date('2026-03-04T18:00:00Z'),
    );
    expect(map.get(1)?.dueOn).toBe('2026-03-07');
    expect(map.get(1)?.variant).toBe('warning');
  });
});
