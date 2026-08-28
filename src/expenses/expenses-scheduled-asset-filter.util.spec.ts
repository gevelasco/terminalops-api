import { applyScheduledExpenseAssetFilter } from './expenses-scheduled-asset-filter.util';

function mockQb() {
  const clauses: Array<{ sql: string; params?: object }> = [];
  const qb = {
    andWhere(sql: string, params?: object) {
      clauses.push({ sql, params });
      return qb;
    },
  };
  return { qb, clauses };
}

describe('applyScheduledExpenseAssetFilter', () => {
  it('scopes equipment rows by equipment id even if a unit id is also present', () => {
    const { qb, clauses } = mockQb();
    applyScheduledExpenseAssetFilter(qb as never, {
      relatedUnitId: 7,
      relatedEquipmentId: 9,
    });
    expect(clauses).toEqual([
      {
        sql: 'e.relatedEquipmentId = :scheduledEquipmentId',
        params: { scheduledEquipmentId: 9 },
      },
    ]);
  });

  it('scopes unit rows to that unit and excludes equipment installments', () => {
    const { qb, clauses } = mockQb();
    applyScheduledExpenseAssetFilter(qb as never, { relatedUnitId: 7 });
    expect(clauses.map((c) => c.sql)).toEqual([
      'e.relatedUnitId = :scheduledUnitId',
      'e.relatedEquipmentId IS NULL',
    ]);
  });

  it('adds no asset filter when neither id is present', () => {
    const { qb, clauses } = mockQb();
    applyScheduledExpenseAssetFilter(qb as never, {});
    expect(clauses).toEqual([]);
  });
});
