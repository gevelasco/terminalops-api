import {
  nextBiweeklyPayDueYmd,
  nextMonthlyPayDueYmd,
  nextWeeklyPayDueYmd,
  previousWeeklyPayDueYmd,
  resolveOperatorPayAlertDueYmd,
  resolveProjectedOperatorPayDueYmd,
} from './operator-payment-schedule.util';

describe('operator-payment-schedule.util', () => {
  it('nextWeeklyPayDueYmd returns same day on Saturday', () => {
    expect(nextWeeklyPayDueYmd('2026-03-07')).toBe('2026-03-07');
  });

  it('nextWeeklyPayDueYmd returns upcoming Saturday', () => {
    expect(nextWeeklyPayDueYmd('2026-03-04')).toBe('2026-03-07');
  });

  it('nextBiweeklyPayDueYmd returns 15th or month end', () => {
    expect(nextBiweeklyPayDueYmd('2026-03-04')).toBe('2026-03-15');
    expect(nextBiweeklyPayDueYmd('2026-03-16')).toBe('2026-03-31');
    expect(nextBiweeklyPayDueYmd('2026-04-01')).toBe('2026-04-15');
  });

  it('nextMonthlyPayDueYmd returns last day of month', () => {
    expect(nextMonthlyPayDueYmd('2026-02-10')).toBe('2026-02-28');
    expect(nextMonthlyPayDueYmd('2026-03-01')).toBe('2026-03-31');
  });

  it('resolveOperatorPayAlertDueYmd for maneuver uses trip completion', () => {
    expect(
      resolveOperatorPayAlertDueYmd('maneuver', '2026-03-10', [
        '2026-03-01',
        '2026-02-20',
      ]),
    ).toBe('2026-02-20');
  });

  it('resolveOperatorPayAlertDueYmd for weekly shows overdue Saturday', () => {
    const previousSaturday = previousWeeklyPayDueYmd('2026-03-08');
    expect(previousSaturday).toBe('2026-03-07');
    expect(
      resolveOperatorPayAlertDueYmd('weekly', '2026-03-08', ['2026-03-05']),
    ).toBe('2026-03-07');
  });

  it('resolveOperatorPayAlertDueYmd for weekly shows next Saturday when not overdue', () => {
    expect(
      resolveOperatorPayAlertDueYmd('weekly', '2026-03-04', ['2026-03-03']),
    ).toBe('2026-03-07');
  });

  it('resolveOperatorPayAlertDueYmd for biweekly uses 15th and month end', () => {
    expect(
      resolveOperatorPayAlertDueYmd('biweekly', '2026-03-10', ['2026-03-01']),
    ).toBe('2026-03-15');
    expect(
      resolveOperatorPayAlertDueYmd('biweekly', '2026-03-20', ['2026-03-16']),
    ).toBe('2026-03-31');
    expect(
      resolveOperatorPayAlertDueYmd('biweekly', '2026-03-20', ['2026-03-10']),
    ).toBe('2026-03-15');
  });

  it('resolveOperatorPayAlertDueYmd for monthly uses month end', () => {
    expect(
      resolveOperatorPayAlertDueYmd('monthly', '2026-03-10', ['2026-03-01']),
    ).toBe('2026-03-31');
  });

  it('resolveProjectedOperatorPayDueYmd maps Tuesday completion to Saturday for weekly', () => {
    expect(resolveProjectedOperatorPayDueYmd('weekly', '2026-07-07')).toBe('2026-07-11');
  });

  it('resolveProjectedOperatorPayDueYmd uses completion day for maneuver', () => {
    expect(resolveProjectedOperatorPayDueYmd('maneuver', '2026-07-15')).toBe('2026-07-15');
  });
});
