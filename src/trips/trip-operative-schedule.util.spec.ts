import {
  tripOperativeArrivalAt,
  tripOperativeDepartureAt,
} from './trip-operative-schedule.util';
import type { Trip } from './entities/trip.entity';

describe('trip-operative-schedule.util', () => {
  it('uses planned arrival when no valid actual', () => {
    const planned = new Date('2026-11-25T16:00:00.000Z');
    const trip = {
      status: 'in_transit',
      plannedDepartureAt: new Date('2026-11-24T07:10:00.000Z'),
      plannedArrivalAt: planned,
      plannedCompletionAt: new Date('2026-11-27T02:10:00.000Z'),
    } as Trip;
    expect(tripOperativeArrivalAt(trip)?.getTime()).toBe(planned.getTime());
  });

  it('prefers actual arrival when in_transit', () => {
    const actual = new Date('2026-11-25T18:30:00.000Z');
    const trip = {
      status: 'in_transit',
      createdAt: new Date('2026-11-20T00:00:00.000Z'),
      departureAt: new Date('2026-11-24T07:10:00.000Z'),
      arrivedAt: actual,
      returnAt: new Date('2026-11-27T02:10:00.000Z'),
      plannedDepartureAt: new Date('2026-11-24T07:10:00.000Z'),
      plannedArrivalAt: new Date('2026-11-25T16:00:00.000Z'),
      plannedCompletionAt: new Date('2026-11-27T02:10:00.000Z'),
    } as Trip;
    expect(tripOperativeArrivalAt(trip)?.getTime()).toBe(actual.getTime());
    expect(tripOperativeDepartureAt(trip)?.getTime()).toBe(
      trip.departureAt!.getTime(),
    );
  });
});