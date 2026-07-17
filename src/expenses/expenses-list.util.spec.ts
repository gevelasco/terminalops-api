import {
  EXPENSE_LIST_DEFAULT_LIMIT,
  normalizeExpenseListLimit,
} from './expenses-list.util';

describe('normalizeExpenseListLimit', () => {
  it.each([undefined, 0, -1, 101, 12])(
    'uses the safe default for %s',
    (limit) => {
      expect(normalizeExpenseListLimit(limit)).toBe(EXPENSE_LIST_DEFAULT_LIMIT);
    },
  );

  it.each([10, 15, 25, 50, 100])('accepts the supported limit %s', (limit) => {
    expect(normalizeExpenseListLimit(limit)).toBe(limit);
  });
});
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

  it('includes payment method and date search when q is set', () => {
    const qb = mockQueryBuilder();
    applyExpenseListFilters(qb, 1, { q: 'Transferencia' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("e.payment_method IN ('transfer')"),
      { q: '%Transferencia%', companyId: 1 },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("TO_CHAR((e.incurred_at AT TIME ZONE 'America/Mexico_City'), 'DD/MM/YYYY') ILIKE :q"),
      { q: '%Transferencia%', companyId: 1 },
    );
  });

  it('binds exact search date when q looks like a date', () => {
    const qb = mockQueryBuilder();
    applyExpenseListFilters(qb, 1, { q: '11/07/2026' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('searchDateYmd'),
      { q: '%11/07/2026%', companyId: 1, searchDateYmd: '2026-07-11' },
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
