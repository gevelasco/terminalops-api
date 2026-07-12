import {
  notificationOverdueFetchFrom,
  resolveNotificationPeriodRange,
} from './notification-period.util';

describe('notification-period.util', () => {
  it('resolves day range to a single calendar day in MX', () => {
    const range = resolveNotificationPeriodRange(
      'day',
      new Date('2026-07-07T18:00:00.000Z'),
    );
    expect(range.from).toBe('2026-07-07');
    expect(range.to).toBe('2026-07-07');
    expect(range.today).toBe('2026-07-07');
  });

  it('extends overdue fetch window 12 months back', () => {
    expect(notificationOverdueFetchFrom('2026-07-07')).toBe('2025-07-07');
  });
});
