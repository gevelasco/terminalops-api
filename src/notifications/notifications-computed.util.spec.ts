import { LEDGER_SCHEDULED_KINDS } from 'src/expenses/ledger-scheduled-kinds';
import type { ExpenseCalendarEntry } from 'src/expenses/expenses-calendar-projection.util';
import { buildComputedPaymentNotifications } from './notifications-computed.util';

function entry(
  partial: Partial<ExpenseCalendarEntry> & Pick<ExpenseCalendarEntry, 'id' | 'dateYmd'>,
): ExpenseCalendarEntry {
  return {
    entryType: 'actual',
    sortDate: partial.dateYmd,
    rubroLabel: 'Seguros',
    conceptLabel: partial.conceptLabel ?? 'Póliza',
    amount: '1000',
    currency: 'MXN',
    statusLabel: partial.statusLabel ?? 'Pendiente',
    kind: partial.kind ?? 'insurance',
    expenseId: partial.expenseId ?? 1,
    ...partial,
  };
}

describe('buildComputedPaymentNotifications', () => {
  const range = { today: '2026-08-27', soonUntil: '2026-09-01' };

  it('includes overdue, today and upcoming within the reminder window', () => {
    const rows = buildComputedPaymentNotifications(
      [
        entry({ id: '1', dateYmd: '2026-08-10', statusLabel: 'Vencido', expenseId: 1 }),
        entry({ id: '2', dateYmd: '2026-08-27', statusLabel: 'Pendiente', expenseId: 2 }),
        entry({
          id: '3',
          dateYmd: '2026-09-01',
          statusLabel: 'Pendiente',
          kind: 'gps',
          conceptLabel: 'GPS',
          expenseId: 3,
        }),
        entry({ id: '4', dateYmd: '2026-09-10', statusLabel: 'Pendiente', expenseId: 4 }),
      ],
      range,
    );

    expect(rows.map((row) => row.kind)).toEqual([
      'payment.overdue',
      'payment.due_today',
      'payment.due_soon',
    ]);
    expect(rows[2]?.title).toBe('Pago de GPS próximo');
  });

  it('skips paid or non-scheduled kinds', () => {
    const rows = buildComputedPaymentNotifications(
      [
        entry({
          id: '1',
          dateYmd: '2026-08-27',
          statusLabel: 'Pagado',
          expenseId: 1,
        }),
        entry({
          id: '2',
          dateYmd: '2026-08-27',
          statusLabel: 'Pendiente',
          kind: 'fuel',
          expenseId: 2,
        }),
      ],
      range,
    );
    expect(rows).toEqual([]);
  });

  it('covers every ledger scheduled kind', () => {
    expect([...LEDGER_SCHEDULED_KINDS]).toEqual([
      'insurance',
      'gps',
      'verification',
      'tenure_payment',
      'operator_payment',
      'operator_commission',
    ]);
  });
});
