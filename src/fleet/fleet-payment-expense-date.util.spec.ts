import { resolveFleetCyclePaymentIncurredDate } from './fleet-payment-expense-date.util';

describe('fleet-payment-expense-date.util', () => {
  it('uses today when the cycle due date is in the past', () => {
    const today = new Date('2026-07-02T15:00:00-06:00');
    expect(resolveFleetCyclePaymentIncurredDate('2026-06-01', today)).toBe(
      '2026-07-02',
    );
  });

  it('keeps the cycle due date when it is today or in the future', () => {
    const today = new Date('2026-07-02T15:00:00-06:00');
    expect(resolveFleetCyclePaymentIncurredDate('2026-07-02', today)).toBe(
      '2026-07-02',
    );
    expect(resolveFleetCyclePaymentIncurredDate('2026-07-15', today)).toBe(
      '2026-07-15',
    );
  });
});
