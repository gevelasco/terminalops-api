import {
  exposeTripActualSchedule,
  hasSpuriousActualScheduleCluster,
} from './resolve-exposed-actual-schedule';

describe('resolve-exposed-actual-schedule', () => {
  const createdAt = new Date('2026-06-15T22:40:00.000Z');
  const samePolluted = new Date('2026-06-15T22:40:00.000Z');

  it('returns null actuals for scheduled trips', () => {
    expect(
      exposeTripActualSchedule({
        status: 'scheduled',
        createdAt,
        departureAt: samePolluted,
        arrivedAt: samePolluted,
        returnAt: samePolluted,
      }),
    ).toEqual({
      departureAt: null,
      arrivedAt: null,
      returnAt: null,
    });
  });

  it('detects spurious clusters of identical actual dates', () => {
    expect(
      hasSpuriousActualScheduleCluster({
        status: 'in_transit',
        departureAt: samePolluted,
        arrivedAt: samePolluted,
        returnAt: samePolluted,
      }),
    ).toBe(true);
  });

  it('exposes distinct actual dates for in_transit trips', () => {
    const departureAt = new Date('2026-06-17T22:39:00.000Z');
    const arrivedAt = new Date('2026-06-23T22:39:00.000Z');
    const returnAt = new Date('2026-06-30T22:39:00.000Z');

    expect(
      exposeTripActualSchedule({
        status: 'in_transit',
        createdAt,
        departureAt,
        arrivedAt,
        returnAt,
      }),
    ).toEqual({ departureAt, arrivedAt, returnAt });
  });

  it('drops actual dates equal to createdAt', () => {
    expect(
      exposeTripActualSchedule({
        status: 'in_transit',
        createdAt,
        departureAt: createdAt,
        arrivedAt: null,
        returnAt: null,
      }),
    ).toEqual({
      departureAt: null,
      arrivedAt: null,
      returnAt: null,
    });
  });
});
