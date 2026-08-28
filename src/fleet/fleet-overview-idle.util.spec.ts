import {
  daysWithoutManeuverSince,
  resolveTripEndedAt,
} from './fleet-overview-idle.util';

describe('daysWithoutManeuverSince', () => {
  it('is 0 on the same operational day in Mexico City', () => {
    const ended = new Date('2026-08-20T18:00:00.000Z');
    const now = new Date('2026-08-21T05:00:00.000Z');
    expect(daysWithoutManeuverSince(ended, now)).toBe(0);
  });

  it('counts calendar days from the next operational day', () => {
    const ended = new Date('2026-08-20T18:00:00.000Z');
    const now = new Date('2026-08-21T06:00:00.000Z');
    expect(daysWithoutManeuverSince(ended, now)).toBe(1);
  });

  it('is 0 when the end is in the future', () => {
    const ended = new Date('2026-08-28T12:00:00.000Z');
    const now = new Date('2026-08-27T12:00:00.000Z');
    expect(daysWithoutManeuverSince(ended, now)).toBe(0);
  });
});

describe('resolveTripEndedAt', () => {
  it('uses returnAt as the end of the maneuver', () => {
    expect(
      resolveTripEndedAt({
        returnAt: new Date('2026-08-10T15:00:00.000Z'),
        completedAt: new Date('2026-08-12T15:00:00.000Z'),
      }),
    ).toEqual(new Date('2026-08-10T15:00:00.000Z'));
  });

  it('falls back to completedAt when there is no returnAt', () => {
    expect(
      resolveTripEndedAt({
        returnAt: null,
        completedAt: new Date('2026-08-12T15:00:00.000Z'),
      }),
    ).toEqual(new Date('2026-08-12T15:00:00.000Z'));
  });

  it('returns null without a real completion stamp', () => {
    expect(resolveTripEndedAt({})).toBeNull();
  });
});
