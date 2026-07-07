import {
  fleetInsuranceDedupKey,
  fleetInsuranceIncurredAtMatchSql,
  normalizeInsuranceOperationalDate,
  selectDuplicateFleetInsuranceExpenseIds,
  type FleetInsuranceExpenseRow,
} from './expenses-insurance-dedup.util';

describe('expenses-insurance-dedup.util', () => {
  it('matches operational Mexico date and legacy UTC midnight', () => {
    const sql = fleetInsuranceIncurredAtMatchSql('e');
    expect(sql).toContain("AT TIME ZONE 'America/Mexico_City'");
    expect(sql).toContain("AT TIME ZONE 'UTC'");
    expect(sql).toContain(':incurredDate');
  });

  it('normalizes legacy UTC midnight to contract calendar day', () => {
    expect(
      normalizeInsuranceOperationalDate(new Date('2026-06-01T00:00:00.000Z')),
    ).toBe('2026-06-01');
    expect(
      normalizeInsuranceOperationalDate(new Date('2026-06-01T18:00:00.000Z')),
    ).toBe('2026-06-01');
  });

  it('groups legacy and fixed timezone rows as duplicates', () => {
    const rows = [
      {
        id: 1,
        company_id: 1,
        insurance_target: 'unit',
        related_unit_id: 10,
        related_equipment_id: null,
        amount: '8500.00',
        category: 'AXA',
        incurred_at: new Date('2026-06-01T00:00:00.000Z'),
      },
      {
        id: 2,
        company_id: 1,
        insurance_target: 'unit',
        related_unit_id: 10,
        related_equipment_id: null,
        amount: '8500.00',
        category: 'AXA',
        incurred_at: new Date('2026-06-01T18:00:00.000Z'),
      },
      {
        id: 3,
        company_id: 1,
        insurance_target: 'unit',
        related_unit_id: 10,
        related_equipment_id: null,
        amount: '8500.00',
        category: 'AXA',
        incurred_at: new Date('2026-06-01T00:00:00.000Z'),
      },
    ] satisfies FleetInsuranceExpenseRow[];

    expect(fleetInsuranceDedupKey(rows[0])).toBe(fleetInsuranceDedupKey(rows[1]));
    expect(selectDuplicateFleetInsuranceExpenseIds(rows)).toEqual([1, 3]);
  });

  it('keeps distinct insurance payments on different dates', () => {
    const rows = [
      {
        id: 10,
        company_id: 1,
        insurance_target: 'unit',
        related_unit_id: 11,
        related_equipment_id: null,
        amount: '90000.00',
        category: 'Qualitas',
        incurred_at: new Date('2026-05-25T18:00:00.000Z'),
      },
      {
        id: 11,
        company_id: 1,
        insurance_target: 'unit',
        related_unit_id: 11,
        related_equipment_id: null,
        amount: '90000.00',
        category: 'Qualitas',
        incurred_at: new Date('2026-05-26T18:00:00.000Z'),
      },
    ] satisfies FleetInsuranceExpenseRow[];

    expect(selectDuplicateFleetInsuranceExpenseIds(rows)).toEqual([]);
  });
});
