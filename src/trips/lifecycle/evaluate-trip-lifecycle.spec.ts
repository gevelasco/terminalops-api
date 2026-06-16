import {
  evaluateTripLifecycle,
  resolveTripLifecycleStatus,
} from './evaluate-trip-lifecycle';

describe('evaluateTripLifecycle', () => {
  const departure = new Date('2026-06-20T08:00:00Z');
  const completion = new Date('2026-06-20T20:00:00Z');

  it('scheduled → in_transit when now >= planned_departure', () => {
    const result = evaluateTripLifecycle({
      status: 'scheduled',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      openIncidentCount: 0,
      now: new Date('2026-06-20T08:00:00Z'),
    });
    expect(result.nextStatus).toBe('in_transit');
  });

  it('scheduled stays scheduled before planned_departure', () => {
    const result = evaluateTripLifecycle({
      status: 'scheduled',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      openIncidentCount: 0,
      now: new Date('2026-06-20T07:59:00Z'),
    });
    expect(result.nextStatus).toBeNull();
  });

  it('in_transit → completed when now >= planned_completion and no open incidents', () => {
    const result = evaluateTripLifecycle({
      status: 'in_transit',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      openIncidentCount: 0,
      now: new Date('2026-06-20T20:00:00Z'),
    });
    expect(result.nextStatus).toBe('completed');
  });

  it('in_transit blocked by open incidents', () => {
    const result = evaluateTripLifecycle({
      status: 'in_transit',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      openIncidentCount: 1,
      now: new Date('2026-06-20T21:00:00Z'),
    });
    expect(result.nextStatus).toBeNull();
  });

  it('never transitions cancelled or completed', () => {
    expect(
      evaluateTripLifecycle({
        status: 'cancelled',
        plannedDepartureAt: departure,
        plannedCompletionAt: completion,
        openIncidentCount: 0,
        now: new Date('2026-06-21T00:00:00Z'),
      }).nextStatus,
    ).toBeNull();

    expect(
      evaluateTripLifecycle({
        status: 'completed',
        plannedDepartureAt: departure,
        plannedCompletionAt: completion,
        openIncidentCount: 0,
        now: new Date('2026-06-21T00:00:00Z'),
      }).nextStatus,
    ).toBeNull();
  });

  it('resolveTripLifecycleStatus chains scheduled → in_transit → completed', () => {
    const status = resolveTripLifecycleStatus({
      status: 'scheduled',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      openIncidentCount: 0,
      now: new Date('2026-06-20T21:00:00Z'),
    });
    expect(status).toBe('completed');
  });
});
