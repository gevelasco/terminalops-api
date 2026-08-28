import { LEDGER_SCHEDULED_KINDS } from 'src/expenses/ledger-scheduled-kinds';
import type { ExpenseCalendarEntry } from 'src/expenses/expenses-calendar-projection.util';
import { formatExpenseNotificationAmount } from 'src/expenses/expense-fleet-relation-label.util';
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

  it('includes month, amount and unit on an overdue financing installment', () => {
    const rows = buildComputedPaymentNotifications(
      [
        entry({
          id: '10',
          dateYmd: '2026-08-10',
          statusLabel: 'Vencido',
          kind: 'tenure_payment',
          conceptLabel: 'Financiamiento - mensual',
          description: 'Cuota de financiamiento (Mensualidad 2/12)',
          amount: '8500.00',
          relatedUnitLabel: 'HYU-2021-81-AA-9K',
          relatedUnitId: 7,
          expenseId: 10,
        }),
      ],
      range,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe('Cuota de financiamiento vencido');
    expect(rows[0]?.subjectLabel).toBe(
      `Unidad HYU-2021-81-AA-9K · Cuota de financiamiento (Mensualidad 2/12) · ${formatExpenseNotificationAmount('8500.00')}`,
    );
  });

  it('includes the unit or equipment on an overdue verification payment', () => {
    const unitRow = buildComputedPaymentNotifications(
      [
        entry({
          id: '20',
          dateYmd: '2026-08-10',
          statusLabel: 'Vencido',
          kind: 'verification',
          conceptLabel: 'Verificación - físico-mecánica',
          description: 'Pago de verificación - físico-mecánica',
          amount: '1500.00',
          relatedUnitLabel: 'HYU-2021-81-AA-9K',
          relatedUnitId: 7,
          expenseId: 20,
        }),
      ],
      range,
    );
    expect(unitRow[0]?.title).toBe('Pago de verificación vencido');
    expect(unitRow[0]?.subjectLabel).toBe(
      `Unidad HYU-2021-81-AA-9K · Pago de verificación - físico-mecánica · ${formatExpenseNotificationAmount('1500.00')}`,
    );

    const equipmentRow = buildComputedPaymentNotifications(
      [
        entry({
          id: '21',
          dateYmd: '2026-08-10',
          statusLabel: 'Vencido',
          kind: 'verification',
          conceptLabel: 'Verificación - doble articulado',
          description: 'Pago de verificación - doble articulado',
          amount: '1800.00',
          relatedEquipmentLabel: 'FRE-2019-44-XY-1Z',
          relatedEquipmentId: 9,
          expenseId: 21,
        }),
      ],
      range,
    );
    expect(equipmentRow[0]?.subjectLabel).toBe(
      `Equipo FRE-2019-44-XY-1Z · Pago de verificación - doble articulado · ${formatExpenseNotificationAmount('1800.00')}`,
    );
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
