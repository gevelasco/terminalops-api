import {
  classifyPaymentReminder,
  normalizePaymentReminderDays,
  paymentReminderDedupeKey,
  paymentReminderEventKind,
  paymentReminderTitle,
} from './payment-reminder.util';

describe('payment-reminder.util', () => {
  it('clamps reminder days to 1–15 and defaults to 5', () => {
    expect(normalizePaymentReminderDays(undefined)).toBe(5);
    expect(normalizePaymentReminderDays(null)).toBe(5);
    expect(normalizePaymentReminderDays(0)).toBe(1);
    expect(normalizePaymentReminderDays(5)).toBe(5);
    expect(normalizePaymentReminderDays(15)).toBe(15);
    expect(normalizePaymentReminderDays(99)).toBe(15);
    expect(normalizePaymentReminderDays('8')).toBe(8);
  });

  it('classifies overdue, today and soon within the configured window', () => {
    expect(classifyPaymentReminder('2026-08-20', '2026-08-27', '2026-09-01')).toBe(
      'overdue',
    );
    expect(classifyPaymentReminder('2026-08-27', '2026-08-27', '2026-09-01')).toBe(
      'today',
    );
    expect(classifyPaymentReminder('2026-09-01', '2026-08-27', '2026-09-01')).toBe(
      'soon',
    );
    expect(classifyPaymentReminder('2026-09-02', '2026-08-27', '2026-09-01')).toBeNull();
  });

  it('builds stable titles and dedupe keys', () => {
    expect(paymentReminderTitle('insurance', 'soon')).toBe('Pago de seguro próximo');
    expect(paymentReminderTitle('gps', 'overdue')).toBe('Pago de GPS vencido');
    expect(paymentReminderEventKind('soon')).toBe('payment.due_soon');
    expect(paymentReminderDedupeKey('overdue', 42, '2026-08-10')).toBe(
      'payment-reminder:overdue:42:2026-08-10',
    );
  });
});
