import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import {
  buildNextPayDueByOperatorId,
  buildOperatorLastManeuverSnapshot,
} from './operator-list-enrichment.util';

function trip(partial: Partial<Trip> & Pick<Trip, 'id' | 'operatorId'>): Trip {
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
    plannedDepartureAt: new Date('2026-01-01T12:00:00Z'),
    plannedArrivalAt: new Date('2026-01-02T12:00:00Z'),
    plannedCompletionAt: new Date('2026-01-03T12:00:00Z'),
    isDelayed: false,
    openIncidentCount: 0,
    creditDays: 0,
    hasIncident: false,
    isRoundTrip: true,
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

  it('buildNextPayDueByOperatorId picks earliest completion for maneuver schedule', () => {
    const trips = [
      trip({
        id: 1,
        operatorId: 5,
        operatorQuota: '1000',
        returnAt: new Date('2026-03-01T12:00:00Z'),
      }),
      trip({
        id: 2,
        operatorId: 5,
        operatorQuota: '800',
        returnAt: new Date('2026-02-20T12:00:00Z'),
      }),
    ];
    const expenses: Expense[] = [];
    const map = buildNextPayDueByOperatorId(
      trips,
      expenses,
      new Map([[5, 'maneuver']]),
      new Date('2026-03-05T12:00:00Z'),
    );
    expect(map.get(5)?.dueOn).toBe('2026-02-20');
    expect(map.get(5)?.variant).toBe('danger');
    expect(map.get(5)?.owedAmount).toBe(1800);
  });

  it('buildNextPayDueByOperatorId uses completion date for maneuver without grace days', () => {
    const trips = [
      trip({
        id: 3,
        operatorId: 5,
        operatorQuota: '2500',
        plannedCompletionAt: new Date('2026-06-04T12:00:00Z'),
        creditDays: 7,
      }),
    ];
    const map = buildNextPayDueByOperatorId(
      trips,
      [],
      new Map([[5, 'maneuver']]),
      new Date('2026-06-17T12:00:00Z'),
    );
    expect(map.get(5)?.dueOn).toBe('2026-06-04');
    expect(map.get(5)?.variant).toBe('danger');
    expect(map.get(5)?.owedAmount).toBe(2500);
  });

  it('buildNextPayDueByOperatorId uses next Saturday for weekly schedule', () => {
    const trips = [
      trip({
        id: 4,
        operatorId: 1,
        operatorQuota: '2500',
        returnAt: new Date('2026-03-03T12:00:00Z'),
      }),
    ];
    const map = buildNextPayDueByOperatorId(
      trips,
      [],
      new Map([[1, 'weekly']]),
      new Date('2026-03-04T12:00:00Z'),
    );
    expect(map.get(1)?.dueOn).toBe('2026-03-07');
    expect(map.get(1)?.variant).toBe('warning');
  });

  it('buildNextPayDueByOperatorId uses biweekly pay dates', () => {
    const trips = [
      trip({
        id: 5,
        operatorId: 2,
        operatorQuota: '1000',
        returnAt: new Date('2026-03-10T12:00:00Z'),
      }),
    ];
    const map = buildNextPayDueByOperatorId(
      trips,
      [],
      new Map([[2, 'biweekly']]),
      new Date('2026-03-12T12:00:00Z'),
    );
    expect(map.get(2)?.dueOn).toBe('2026-03-15');
  });

  it('buildNextPayDueByOperatorId treats missing status as completed when pre-filtered', () => {
    const trips = [
      trip({
        id: 4,
        operatorId: 1,
        operatorQuota: '2500',
        returnAt: new Date('2026-06-04T12:00:00Z'),
        status: undefined as unknown as Trip['status'],
      }),
    ];
    const map = buildNextPayDueByOperatorId(
      trips,
      [],
      new Map([[1, 'maneuver']]),
      new Date('2026-06-17T12:00:00Z'),
    );
    expect(map.get(1)?.dueOn).toBe('2026-06-04');
    expect(map.get(1)?.owedAmount).toBe(2500);
  });
});
