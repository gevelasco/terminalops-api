import {
  expenseRubroSearchSql,
  normalizeExpenseListSearchQuery,
  rubroKeysMatchingExpenseSearch,
} from './expense-list-search.util';

describe('expense-list-search.util', () => {
  it('strips Rubro: prefix from search text', () => {
    expect(normalizeExpenseListSearchQuery('Rubro: Seguros')).toBe('Seguros');
  });

  it('matches seguros and gps rubros by label', () => {
    expect(rubroKeysMatchingExpenseSearch('Seguros')).toEqual(['seguros']);
    expect(rubroKeysMatchingExpenseSearch('seguros')).toEqual(['seguros']);
    expect(rubroKeysMatchingExpenseSearch('GPS')).toEqual(['gps']);
    expect(rubroKeysMatchingExpenseSearch('Seguros y GPS')).toEqual([
      'seguros',
      'gps',
    ]);
  });

  it('builds SQL for seguros and gps kinds', () => {
    expect(expenseRubroSearchSql(['seguros'])).toContain("e.kind = 'insurance'");
    expect(expenseRubroSearchSql(['gps'])).toContain("e.kind = 'gps'");
  });

  it('matches maniobra rubro by partial label', () => {
    expect(rubroKeysMatchingExpenseSearch('Maniobra')).toEqual(['maniobra']);
  });
});
