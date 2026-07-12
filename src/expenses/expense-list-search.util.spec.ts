import {
  expenseRubroSearchSql,
  normalizeExpenseListSearchQuery,
  parseExpenseListSearchDateYmd,
  paymentMethodsMatchingExpenseSearch,
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

  it('matches payment methods by Spanish label and code', () => {
    expect(paymentMethodsMatchingExpenseSearch('Transferencia')).toEqual([
      'transfer',
    ]);
    expect(paymentMethodsMatchingExpenseSearch('efectivo')).toEqual(['cash']);
    expect(paymentMethodsMatchingExpenseSearch('tarjeta')).toEqual(
      expect.arrayContaining(['debit_card', 'credit_card', 'card']),
    );
  });

  it('parses common date formats for exact day search', () => {
    expect(parseExpenseListSearchDateYmd('2026-07-11')).toBe('2026-07-11');
    expect(parseExpenseListSearchDateYmd('11/07/2026')).toBe('2026-07-11');
    expect(parseExpenseListSearchDateYmd('11-07-26')).toBe('2026-07-11');
    expect(parseExpenseListSearchDateYmd('Transferencia')).toBeNull();
  });
});
