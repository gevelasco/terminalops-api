import {
  normalizeOperatorPaymentSchedule,
  tripCompletionAnchorYmd,
} from './operator-payment-schedule.util';

describe('operator-payment-schedule.util', () => {
  it('normalizeOperatorPaymentSchedule keeps known cadences and defaults to maneuver', () => {
    expect(normalizeOperatorPaymentSchedule('weekly')).toBe('weekly');
    expect(normalizeOperatorPaymentSchedule('biweekly')).toBe('biweekly');
    expect(normalizeOperatorPaymentSchedule('monthly')).toBe('monthly');
    expect(normalizeOperatorPaymentSchedule('maneuver')).toBe('maneuver');
    expect(normalizeOperatorPaymentSchedule(null)).toBe('maneuver');
  });

  it('tripCompletionAnchorYmd prefers return, then planned completion, then completed', () => {
    expect(
      tripCompletionAnchorYmd({
        returnAt: new Date('2026-03-10T18:00:00Z'),
        plannedCompletionAt: new Date('2026-03-08T18:00:00Z'),
        completedAt: new Date('2026-03-09T18:00:00Z'),
        arrivedAt: new Date('2026-03-09T12:00:00Z'),
      }),
    ).toBe('2026-03-10');
    expect(
      tripCompletionAnchorYmd({
        returnAt: null,
        plannedCompletionAt: new Date('2026-07-15T18:00:00Z'),
        completedAt: null,
        arrivedAt: null,
      }),
    ).toBe('2026-07-15');
    expect(
      tripCompletionAnchorYmd({
        returnAt: null,
        plannedCompletionAt: null,
        completedAt: null,
        arrivedAt: null,
      }),
    ).toBeNull();
  });
});
