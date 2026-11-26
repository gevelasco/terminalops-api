import {
  notificationOverdueFetchFrom,
  resolveNotificationPeriodRange,
  ymdAddDays,
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

  it('maps day bounds to Mexico City wall time in UTC (evening MX)', () => {
    // 19:40 MX = 01:40 UTC del día siguiente; "hoy" MX sigue siendo 25.
    const range = resolveNotificationPeriodRange(
      'day',
      new Date('2026-11-26T01:40:00.000Z'),
    );
    expect(range.today).toBe('2026-11-25');
    expect(range.fromAt.toISOString()).toBe('2026-11-25T06:00:00.000Z'); // 00:00 CST
    expect(range.toAt.toISOString()).toBe('2026-11-26T05:59:59.999Z'); // 23:59:59.999 CST
    // Un evento a las 19:40 MX cae dentro del día civil MX.
    expect(range.fromAt.getTime()).toBeLessThanOrEqual(
      new Date('2026-11-26T01:40:00.000Z').getTime(),
    );
    expect(range.toAt.getTime()).toBeGreaterThanOrEqual(
      new Date('2026-11-26T01:40:00.000Z').getTime(),
    );
  });

  it('keeps afternoon MX events inside the same civil day', () => {
    const range = resolveNotificationPeriodRange(
      'day',
      new Date('2026-11-25T20:00:00.000Z'), // 14:00 MX
    );
    expect(range.today).toBe('2026-11-25');
    expect(
      range.fromAt.getTime() <= new Date('2026-11-25T20:00:00.000Z').getTime(),
    ).toBe(true);
    expect(
      range.toAt.getTime() >= new Date('2026-11-25T20:00:00.000Z').getTime(),
    ).toBe(true);
  });

  it('adds calendar days without host timezone drift', () => {
    expect(ymdAddDays('2026-11-25', 1)).toBe('2026-11-26');
    expect(ymdAddDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('extends overdue fetch window 12 months back', () => {
    expect(notificationOverdueFetchFrom('2026-07-07')).toBe('2025-07-07');
  });
});
