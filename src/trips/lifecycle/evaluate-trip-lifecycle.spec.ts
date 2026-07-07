import {
  evaluateTripLifecycle,
  resolveEffectiveCompletionAt,
  resolveTripLifecycleStatus,
} from './evaluate-trip-lifecycle';

describe('evaluateTripLifecycle', () => {
  const departure = new Date('2026-06-20T08:00:00Z');
  const completion = new Date('2026-06-20T20:00:00Z');
  const actualEnd = new Date('2026-06-21T07:12:00Z');

  it('scheduled → in_transit when now >= planned_departure', () => {
    const result = evaluateTripLifecycle({
      status: 'scheduled',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      now: new Date('2026-06-20T08:00:00Z'),
    });
    expect(result.nextStatus).toBe('in_transit');
  });

  it('scheduled stays scheduled before planned_departure', () => {
    const result = evaluateTripLifecycle({
      status: 'scheduled',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      now: new Date('2026-06-20T07:59:00Z'),
    });
    expect(result.nextStatus).toBeNull();
  });

  it('in_transit → completed when planned_completion passed and no fin real', () => {
    const result = evaluateTripLifecycle({
      status: 'in_transit',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      now: new Date('2026-06-20T21:00:00Z'),
    });
    expect(result.nextStatus).toBe('completed');
  });

  it('in_transit → completed when fin real registrado y ya ocurrió', () => {
    const result = evaluateTripLifecycle({
      status: 'in_transit',
      plannedDepartureAt: departure,
      plannedCompletionAt: new Date('2026-06-25T20:00:00Z'),
      actualCompletionAt: actualEnd,
      now: new Date('2026-06-22T00:00:00Z'),
    });
    expect(result.nextStatus).toBe('completed');
  });

  it('fin real prevalece sobre fin planeado aún no vencido', () => {
    const effective = resolveEffectiveCompletionAt({
      plannedCompletionAt: new Date('2026-06-25T20:00:00Z'),
      actualCompletionAt: actualEnd,
    });
    expect(effective.toISOString()).toBe(actualEnd.toISOString());

    const result = evaluateTripLifecycle({
      status: 'in_transit',
      plannedDepartureAt: departure,
      plannedCompletionAt: new Date('2026-06-25T20:00:00Z'),
      actualCompletionAt: actualEnd,
      now: new Date('2026-06-21T08:00:00Z'),
    });
    expect(result.nextStatus).toBe('completed');
  });

  it('in_transit is not blocked by bitácora incidents', () => {
    const result = evaluateTripLifecycle({
      status: 'in_transit',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      actualCompletionAt: actualEnd,
      now: new Date('2026-06-22T00:00:00Z'),
    });
    expect(result.nextStatus).toBe('completed');
  });

  it('never transitions cancelled or completed', () => {
    expect(
      evaluateTripLifecycle({
        status: 'cancelled',
        plannedDepartureAt: departure,
        plannedCompletionAt: completion,
        now: new Date('2026-06-21T00:00:00Z'),
      }).nextStatus,
    ).toBeNull();

    expect(
      evaluateTripLifecycle({
        status: 'completed',
        plannedDepartureAt: departure,
        plannedCompletionAt: completion,
        now: new Date('2026-06-21T00:00:00Z'),
      }).nextStatus,
    ).toBeNull();
  });

  it('resolveTripLifecycleStatus chains scheduled → in_transit → completed with fin real', () => {
    const status = resolveTripLifecycleStatus({
      status: 'scheduled',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      actualCompletionAt: actualEnd,
      now: new Date('2026-06-22T00:00:00Z'),
    });
    expect(status).toBe('completed');
  });

  it('resolveTripLifecycleStatus chains scheduled → in_transit → completed with fin planeado', () => {
    const status = resolveTripLifecycleStatus({
      status: 'scheduled',
      plannedDepartureAt: departure,
      plannedCompletionAt: completion,
      now: new Date('2026-06-20T21:00:00Z'),
    });
    expect(status).toBe('completed');
  });
});
