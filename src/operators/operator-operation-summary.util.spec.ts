import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import {
  buildOperatorOperationSummary,
  OPERATOR_SUMMARY_RECENT_DAYS,
} from './operator-operation-summary.util';

function trip(partial: Partial<Trip> & Pick<Trip, 'id' | 'status'>): Trip {
  return {
    maneuverCode: 'M-001',
    origin: 'A',
    destination: 'B',
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
    isRoundTrip: false,
    routeDistanceKm: '100',
    operatorQuota: '0',
    ...partial,
  } as Trip;
}

describe('operator-operation-summary.util', () => {
  it('statusCounts and completedKm only include trips from the last 30 days', () => {
    const summary = buildOperatorOperationSummary(
      [
        trip({
          id: 1,
          status: 'completed',
          completedAt: new Date('2026-06-01T12:00:00Z'),
          routeDistanceKm: '500',
        }),
        trip({
          id: 2,
          status: 'completed',
          completedAt: new Date('2026-06-20T12:00:00Z'),
          routeDistanceKm: '992',
        }),
        trip({
          id: 3,
          status: 'completed',
          completedAt: new Date('2026-04-01T12:00:00Z'),
          routeDistanceKm: '2000',
        }),
        trip({
          id: 4,
          status: 'scheduled',
          plannedDepartureAt: new Date('2026-06-18T12:00:00Z'),
        }),
      ],
      [] as Expense[],
      new Map(),
      new Date('2026-06-20T12:00:00Z'),
      'maneuver',
    );

    expect(OPERATOR_SUMMARY_RECENT_DAYS).toBe(30);
    expect(summary.hasTrips).toBe(true);
    expect(summary.statusCounts).toEqual({
      completed: 2,
      inTransit: 0,
      scheduled: 1,
      cancelled: 0,
      total: 3,
    });
    expect(summary.completedKm).toBe(1492);
  });
});
