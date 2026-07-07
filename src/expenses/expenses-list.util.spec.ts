import { applyExpenseListFilters } from './expenses-list.util';
import type { Expense } from './entities/expense.entity';
import type { SelectQueryBuilder } from 'typeorm';

describe('applyExpenseListFilters search', () => {
  function mockQueryBuilder() {
    const andWhere = jest.fn().mockReturnThis();
    const where = jest.fn().mockReturnThis();
    return {
      where,
      andWhere,
    } as unknown as SelectQueryBuilder<Expense> & {
      where: jest.Mock;
      andWhere: jest.Mock;
    };
  }

  it('includes rubro label search for Seguros', () => {
    const qb = mockQueryBuilder();
    applyExpenseListFilters(qb, 1, { q: 'Seguros' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("e.kind = 'insurance'"),
      { q: '%Seguros%', companyId: 1 },
    );
  });

  it('includes maneuver code and vendor in search when q is set', () => {
    const qb = mockQueryBuilder();
    applyExpenseListFilters(qb, 1, { q: 'SF-004' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('maneuver_code ILIKE :q'),
      { q: '%SF-004%', companyId: 1 },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('t.id = e.trip_id'),
      { q: '%SF-004%', companyId: 1 },
    );
  });

  it('does not add text search clause when q is empty', () => {
    const qb = mockQueryBuilder();
    applyExpenseListFilters(qb, 1, { q: '   ' });

    const searchCalls = qb.andWhere.mock.calls.filter(([sql]) =>
      String(sql).includes('maneuver_code'),
    );
    expect(searchCalls).toHaveLength(0);
  });
});
