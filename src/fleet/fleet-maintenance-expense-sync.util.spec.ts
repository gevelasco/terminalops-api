import {
  findNewBillableMaintenanceEntries,
  isBillableMaintenanceEntry,
  isSubstantiveMaintenanceEntry,
  maintenanceEntryFingerprint,
  maintenanceEntryMatchesExpense,
  recomputeLastMaintenanceFields,
} from './fleet-maintenance-expense-sync.util';

describe('fleet-maintenance-expense-sync.util', () => {
  it('fingerprints maintenance entries consistently', () => {
    expect(
      maintenanceEntryFingerprint({
        date: '2026-06-01',
        type: 'Aceite',
        cost: 1500,
      }),
    ).toBe('2026-06-01|Aceite|1500');
  });

  it('detects substantive maintenance with date, cost or notes only', () => {
    expect(isSubstantiveMaintenanceEntry({ type: 'Servicio completo' })).toBe(false);
    expect(isSubstantiveMaintenanceEntry({ date: '2026-06-01', type: 'Aceite' })).toBe(
      true,
    );
    expect(isSubstantiveMaintenanceEntry({ cost: 500 })).toBe(true);
  });

  it('detects billable maintenance with positive cost', () => {
    expect(isBillableMaintenanceEntry({ cost: 500 })).toBe(true);
    expect(isBillableMaintenanceEntry({ cost: 0 })).toBe(false);
    expect(isBillableMaintenanceEntry({ cost: undefined })).toBe(false);
  });

  it('returns only new billable entries', () => {
    const previous = [
      {
        entryDate: '2026-05-01',
        entryType: 'Frenos',
        cost: '800',
      },
    ];
    const incoming = [
      {
        date: '2026-05-01',
        type: 'Frenos',
        cost: 800,
      },
      {
        date: '2026-06-01',
        type: 'Aceite',
        cost: 1200,
      },
    ];

    expect(findNewBillableMaintenanceEntries(previous, incoming)).toEqual([
      {
        date: '2026-06-01',
        type: 'Aceite',
        cost: 1200,
      },
    ]);
  });

  it('matches maintenance entries to expenses by date, type, amount and description', () => {
    expect(
      maintenanceEntryMatchesExpense(
        {
          entryDate: '2026-06-01',
          entryType: 'Aceite',
          cost: '1200',
          notes: 'Taller central',
        },
        {
          category: 'Aceite',
          amount: '1200',
          description: 'Taller central',
        },
        '2026-06-01',
      ),
    ).toBe(true);
  });

  it('recomputes last maintenance fields from remaining entries', () => {
    expect(
      recomputeLastMaintenanceFields([
        {
          entryDate: '2026-05-01',
          entryType: 'Frenos',
          cost: '800',
        },
        {
          entryDate: '2026-06-01',
          entryType: 'Aceite',
          cost: '1200',
          notes: 'Taller',
        },
      ]),
    ).toEqual({
      lastMaintenanceDate: '2026-06-01',
      lastMaintenanceType: 'Aceite',
      lastMaintenanceCost: '1200',
      lastMaintenanceNotes: 'Taller',
    });
  });
});
