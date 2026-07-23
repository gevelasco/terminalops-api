import {
  buildManiobraRalentiReport,
  rateEstimatedHours,
} from './reports-maniobras-ralenti.util';

describe('reports-maniobras-ralenti.util', () => {
  it('converts rate estimates in days to hours', () => {
    expect(rateEstimatedHours(2, 'days')).toBe(48);
    expect(rateEstimatedHours('4.5', 'hours')).toBe(4.5);
    expect(rateEstimatedHours(3, null)).toBeNull();
  });

  it('uses rate baseline when available to reveal padded plan', () => {
    const report = buildManiobraRalentiReport([
      {
        tripId: 1,
        maneuverCode: 'M-1',
        clientName: 'ACME',
        destination: 'Monterrey',
        // Plan padded: 10h outbound
        plannedDepartureAt: '2026-07-01T08:00:00.000Z',
        plannedArrivalAt: '2026-07-01T18:00:00.000Z',
        plannedCompletionAt: '2026-07-02T02:00:00.000Z',
        // Actual: 8h outbound (under padded plan, over rate 6h)
        departureAt: '2026-07-01T08:00:00.000Z',
        arrivedAt: '2026-07-01T16:00:00.000Z',
        returnAt: '2026-07-01T22:00:00.000Z',
        estimatedArrivalTimeValue: '6',
        estimatedReturnTimeValue: '4',
        estimatedTimeUnit: 'hours',
      },
    ]);

    expect(report.tripsEvaluated).toBe(1);
    expect(report.tripsWithRalenti).toBe(1);
    expect(report.salidaClienteHours).toBe(2);
    expect(report.clienteRegresoHours).toBe(2);
    expect(report.totalHours).toBe(4);
    expect(report.events[0]?.baselineSource).toBe('rate');
  });

  it('falls back to planned baseline without rate times', () => {
    const report = buildManiobraRalentiReport([
      {
        tripId: 2,
        maneuverCode: 'M-2',
        clientName: 'Beta',
        destination: 'Saltillo',
        plannedDepartureAt: '2026-07-01T08:00:00.000Z',
        plannedArrivalAt: '2026-07-01T12:00:00.000Z',
        plannedCompletionAt: '2026-07-01T16:00:00.000Z',
        departureAt: '2026-07-01T08:00:00.000Z',
        arrivedAt: '2026-07-01T14:00:00.000Z',
        returnAt: '2026-07-01T20:00:00.000Z',
        estimatedArrivalTimeValue: null,
        estimatedReturnTimeValue: null,
        estimatedTimeUnit: null,
      },
    ]);

    expect(report.salidaClienteHours).toBe(2);
    expect(report.clienteRegresoHours).toBe(2);
    expect(report.events.every((e) => e.baselineSource === 'planned')).toBe(
      true,
    );
  });

  it('ignores legs without actual timestamps', () => {
    const report = buildManiobraRalentiReport([
      {
        tripId: 3,
        maneuverCode: 'M-3',
        clientName: 'Gamma',
        destination: 'NL',
        plannedDepartureAt: '2026-07-01T08:00:00.000Z',
        plannedArrivalAt: '2026-07-01T12:00:00.000Z',
        plannedCompletionAt: '2026-07-01T16:00:00.000Z',
        departureAt: null,
        arrivedAt: null,
        returnAt: null,
        estimatedArrivalTimeValue: '4',
        estimatedReturnTimeValue: '4',
        estimatedTimeUnit: 'hours',
      },
    ]);

    expect(report.tripsEvaluated).toBe(0);
    expect(report.totalHours).toBe(0);
    expect(report.events).toEqual([]);
  });
});
