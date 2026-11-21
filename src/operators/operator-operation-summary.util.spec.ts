import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import {
  buildOperatorOperationSummary,
  OPERATOR_SUMMARY_RECENT_DAYS,
} from './operator-operation-summary.util';

function trip(partial: Partial<Trip> & Pick<Trip, 'id' | 'status'>): Trip {
  return {
    maneuverCode: 'M-001',
    originLocality: 'A',
    destinationLocality: 'B',
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
    routeDistanceKm: '100',
    operatorQuota: '0',
    ...partial,
  } as Trip;
}

describe('operator-operation-summary.util', () => {
  it('statusCounts and completedKm only include trips from the last 30 days', () => {
    const ratesById = new Map([
      [
        10,
        {
          estimatedArrivalTimeValue: '20',
          estimatedReturnTimeValue: '18',
        },
      ],
    ]);
    const summary = buildOperatorOperationSummary(
      [
        trip({
          id: 1,
          status: 'completed',
          completedAt: new Date('2026-06-01T12:00:00Z'),
          routeDistanceKm: '500',
          destinationRateId: 10,
        }),
        trip({
          id: 2,
          status: 'completed',
          completedAt: new Date('2026-06-20T12:00:00Z'),
          routeDistanceKm: '992',
          destinationRateId: 10,
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
      ratesById,
      new Date('2026-06-20T12:00:00Z'),
    );

    expect(OPERATOR_SUMMARY_RECENT_DAYS).toBe(30);
    expect(summary.hasTrips).toBe(true);
    expect(summary.periodManeuverTotal).toBe(3);
    expect(summary.completedKm).toBe(2984);
    expect(summary.workedHours).toBe(76);
    expect(summary.workedDays).toBe(4.8);
    expect(summary.incidentManeuverCount).toBe(0);
  });
});
