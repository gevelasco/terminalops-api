import {
  isTripInvalidForLifecycle,
  sanitizeTripsForLifecycle,
} from './sanitize-trips-for-lifecycle';

describe('sanitizeTripsForLifecycle', () => {
  it('marks trips with null planned_* as invalidForLifecycle', () => {
    const rows = sanitizeTripsForLifecycle([
      {
        plannedDepartureAt: new Date('2026-06-01T08:00:00.000Z'),
        plannedArrivalAt: new Date('2026-06-01T12:00:00.000Z'),
        plannedCompletionAt: new Date('2026-06-01T16:00:00.000Z'),
      },
      {
        plannedDepartureAt: new Date('2026-06-01T08:00:00.000Z'),
        plannedArrivalAt: null as unknown as Date,
        plannedCompletionAt: new Date('2026-06-01T16:00:00.000Z'),
      },
    ]);

    expect(rows[0].invalidForLifecycle).toBe(false);
    expect(rows[1].invalidForLifecycle).toBe(true);
  });

  it('isTripInvalidForLifecycle detects missing completion', () => {
    expect(
      isTripInvalidForLifecycle({
        plannedDepartureAt: new Date(),
        plannedArrivalAt: new Date(),
        plannedCompletionAt: undefined,
      }),
    ).toBe(true);
  });
});
