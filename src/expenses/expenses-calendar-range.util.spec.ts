import {
  assertExpenseCalendarDateRange,
  expenseCalendarInclusiveDaySpan,
  EXPENSE_CALENDAR_MAX_RANGE_DAYS,
} from './expenses-calendar-range.util';

describe('expenses-calendar-range.util', () => {
  it('counts inclusive day span', () => {
    expect(expenseCalendarInclusiveDaySpan('2026-01-01', '2026-01-01')).toBe(1);
    expect(expenseCalendarInclusiveDaySpan('2026-01-01', '2026-01-31')).toBe(31);
  });

  it('normalizes inverted ranges', () => {
    expect(assertExpenseCalendarDateRange('2026-02-10', '2026-02-01')).toEqual({
      from: '2026-02-01',
      to: '2026-02-10',
    });
  });

  it('rejects ranges wider than the cap', () => {
    expect(() =>
      assertExpenseCalendarDateRange('2024-01-01', '2026-12-31'),
    ).toThrow(/no puede superar/);
    expect(EXPENSE_CALENDAR_MAX_RANGE_DAYS).toBe(800);
  });

  it('accepts a 12-month lookback window', () => {
    expect(assertExpenseCalendarDateRange('2025-07-18', '2026-07-31')).toEqual({
      from: '2025-07-18',
      to: '2026-07-31',
    });
  });
});
