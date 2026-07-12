import {
  computeManiobraDurationDays,
  effectiveManiobraCompletionAt,
} from './reports-maniobras-duration.util';

describe('reports-maniobras-duration.util', () => {
  const departure = '2026-01-10T08:00:00.000Z';
  const clientArrival = '2026-01-10T20:00:00.000Z';
  const maneuverEnd = '2026-01-12T18:00:00.000Z';

  it('uses returnAt instead of client arrival for completed trips', () => {
    const days = computeManiobraDurationDays({
      status: 'completed',
      departureAt: departure,
      arrivedAt: clientArrival,
      returnAt: maneuverEnd,
      plannedDepartureAt: departure,
      plannedCompletionAt: maneuverEnd,
      plannedArrivalAt: clientArrival,
    });

    expect(days).toBe(2.4);
  });

  it('prefers returnAt over arrivedAt for completion end', () => {
    const end = effectiveManiobraCompletionAt({
      status: 'completed',
      departureAt: departure,
      arrivedAt: clientArrival,
      returnAt: maneuverEnd,
    });

    expect(end?.toISOString()).toBe(maneuverEnd);
  });

  it('uses now for in-transit trips without returnAt', () => {
    const now = new Date('2026-01-11T08:00:00.000Z');
    const days = computeManiobraDurationDays(
      {
        status: 'in_transit',
        departureAt: departure,
        arrivedAt: clientArrival,
      },
      now,
    );

    expect(days).toBe(1);
  });
});
