import {
  assertActualScheduleChronology,
  detectActualScheduleDeltas,
  applyActualScheduleDeltas,
} from './actual-schedule-update.util';

describe('actual-schedule-update.util', () => {
  const base = {
    departureAt: new Date('2026-01-15T08:00:00.000Z'),
    arrivedAt: null as Date | null,
    returnAt: null as Date | null,
  };

  it('detects partial delta for departure only', () => {
    const deltas = detectActualScheduleDeltas(base, {
      departureAt: new Date('2026-01-15T08:30:00.000Z'),
    });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.field).toBe('departureAt');
  });

  it('returns empty when incoming matches persisted', () => {
    const deltas = detectActualScheduleDeltas(base, {
      departureAt: new Date('2026-01-15T08:00:00.000Z'),
    });
    expect(deltas).toHaveLength(0);
  });

  it('validates chronology for partial pairs', () => {
    expect(() =>
      assertActualScheduleChronology({
        departureAt: new Date('2026-01-15T10:00:00.000Z'),
        arrivedAt: new Date('2026-01-15T09:00:00.000Z'),
        returnAt: null,
      }),
    ).toThrow();
  });

  it('allows departure only without arrival or return', () => {
    expect(() =>
      assertActualScheduleChronology({
        departureAt: new Date('2026-01-15T08:30:00.000Z'),
        arrivedAt: null,
        returnAt: null,
      }),
    ).not.toThrow();
  });

  it('rejects completion before planned arrival when actual arrival is missing', () => {
    expect(() =>
      assertActualScheduleChronology(
        {
          departureAt: null,
          arrivedAt: null,
          returnAt: new Date('2026-01-15T10:00:00.000Z'),
        },
        {
          plannedDepartureAt: new Date('2026-01-15T08:00:00.000Z'),
          plannedArrivalAt: new Date('2026-01-15T12:00:00.000Z'),
          plannedCompletionAt: new Date('2026-01-15T18:00:00.000Z'),
        },
      ),
    ).toThrow('La fecha fin real no puede ser anterior a la llegada con cliente.');
  });

  it('applies deltas onto current values', () => {
    const next = applyActualScheduleDeltas(base, [
      {
        field: 'arrivedAt',
        previous: null,
        next: new Date('2026-01-15T13:00:00.000Z'),
      },
    ]);
    expect(next.arrivedAt?.toISOString()).toBe('2026-01-15T13:00:00.000Z');
    expect(next.departureAt).toEqual(base.departureAt);
  });
});
