import {
  buildExpensesByRubroFromKindRows,
  expenseRubroFromKind,
  expenseRubroLabel,
} from './reports-expense-rubro.util';

describe('reports-expense-rubro.util', () => {
  it('maps insurance and gps kinds to separate rubros', () => {
    expect(expenseRubroFromKind('insurance', null)).toBe('seguros');
    expect(expenseRubroFromKind('gps', null)).toBe('gps');
    expect(expenseRubroLabel('seguros')).toBe('Seguros');
    expect(expenseRubroLabel('gps')).toBe('GPS');
  });

  it('aggregates insurance and gps into separate buckets', () => {
    const rows = buildExpensesByRubroFromKindRows([
      { kind: 'insurance', has_trip: 0, sum: '8500', count: '2' },
      { kind: 'gps', has_trip: 0, sum: '1200', count: '1' },
    ]);

    expect(rows).toEqual([
      { rubro: 'seguros', label: 'Seguros', amount: 8500, count: 2 },
      { rubro: 'gps', label: 'GPS', amount: 1200, count: 1 },
    ]);
  });
});
