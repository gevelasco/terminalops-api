import {
  findScheduleOverlapsAmongTrips,
  tripScheduleWindowFromCandidate,
  tripScheduleWindowsOverlap,
} from './trip-schedule-overlap.util';
import type { Trip } from './entities/trip.entity';

function trip(partial: Partial<Trip> & Pick<Trip, 'id'>): Trip {
  return partial as Trip;
}

describe('tripScheduleWindowsOverlap', () => {
  it('does not overlap when chained end to start', () => {
    const a = tripScheduleWindowFromCandidate(
      new Date('2026-06-01T08:00:00Z'),
      new Date('2026-06-01T20:00:00Z'),
    );
    const b = tripScheduleWindowFromCandidate(
      new Date('2026-06-01T20:00:00Z'),
      new Date('2026-06-02T08:00:00Z'),
    );
    expect(tripScheduleWindowsOverlap(a, b)).toBe(false);
  });

  it('overlaps when windows intersect', () => {
    const a = tripScheduleWindowFromCandidate(
      new Date('2026-06-01T08:00:00Z'),
      new Date('2026-06-02T08:00:00Z'),
    );
    const b = tripScheduleWindowFromCandidate(
      new Date('2026-06-01T20:00:00Z'),
      new Date('2026-06-02T12:00:00Z'),
    );
    expect(tripScheduleWindowsOverlap(a, b)).toBe(true);
  });
});

describe('findScheduleOverlapsAmongTrips', () => {
  it('returns chained scheduled trip on same unit as non-overlap', () => {
    const candidate = tripScheduleWindowFromCandidate(
      new Date('2026-06-02T08:00:00Z'),
      new Date('2026-06-02T20:00:00Z'),
    );
    const active = trip({
      id: 1,
      status: 'in_transit',
      unitId: 9,
      operatorId: 3,
      plannedDepartureAt: new Date('2026-06-01T08:00:00Z'),
      plannedCompletionAt: new Date('2026-06-02T08:00:00Z'),
      maneuverCode: 'A-1',
    });
    expect(
      findScheduleOverlapsAmongTrips(
        candidate,
        [active],
        { id: 0, unitId: 9, operatorId: 3 },
      ),
    ).toEqual([]);
  });
});