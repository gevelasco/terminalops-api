import {
  actualEntryFromSerialized,
  buildLedgerCalendar,
  paginateExpenseCalendarEntries,
} from './expenses-calendar-projection.util';

describe('expenses-calendar-projection.util', () => {
  it('buildLedgerCalendar lists only ledger rows and never invents projected ones', () => {
    const result = buildLedgerCalendar([
      {
        id: 9,
        kind: 'operator_payment',
        category: 'Pago a operador',
        amount: '1200',
        currency: 'MXN',
        incurredDate: '2099-01-15',
        paidAt: null,
        tripId: 1,
      },
      {
        id: 10,
        kind: 'fuel',
        category: 'Diésel',
        amount: '800',
        currency: 'MXN',
        incurredDate: '2026-08-10',
        paidAt: '2026-08-10T18:00:00.000Z',
        tripId: 1,
      },
    ]);

    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((row) => row.entryType === 'actual')).toBe(true);
    expect(result.entries[0]?.statusLabel).toBe('Pendiente');
    expect(result.entries[1]?.statusLabel).toBe('Realizado');
    expect(result.markers.some((marker) => marker.label === 'Por pagar')).toBe(true);
  });

  it('marks unpaid insurance as Por pagar and paid insurance as Recurrentes', () => {
    const result = buildLedgerCalendar([
      {
        id: 1,
        kind: 'insurance',
        category: 'Póliza',
        amount: '10000',
        incurredDate: '2026-08-10',
        paidAt: null,
      },
      {
        id: 2,
        kind: 'insurance',
        category: 'Póliza',
        amount: '10000',
        incurredDate: '2026-07-10',
        paidAt: '2026-07-10T18:00:00.000Z',
      },
    ]);

    const porPagar = result.markers.find((marker) => marker.label === 'Por pagar');
    const recurrentes = result.markers.find((marker) => marker.label === 'Recurrentes');
    expect(porPagar?.amount).toBe('10000.00');
    expect(recurrentes?.amount).toBe('10000.00');
  });

  it('actualEntryFromSerialized keeps kind for downstream ledger filters', () => {
    const entry = actualEntryFromSerialized({
      id: 3,
      kind: 'gps',
      category: 'GPS',
      amount: 450,
      incurredDate: '2026-08-30',
      paidAt: null,
    });
    expect(entry.kind).toBe('gps');
    expect(entry.statusLabel).toBe('Pendiente');
  });

  it('paginates ledger entries without mixing invented rows', () => {
    const entries = [
      { id: 'a1', amount: '10' },
      { id: 'a2', amount: '20' },
    ];
    const page = paginateExpenseCalendarEntries(entries, 1, 1);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe('a1');
  });
});
