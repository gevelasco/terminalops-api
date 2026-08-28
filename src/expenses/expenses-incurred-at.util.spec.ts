import {
  addOperationalMonthsYmd,
  parseOperationalIncurredAt,
} from './expenses-incurred-at.util';

describe('expenses-incurred-at.util', () => {
  it('parses calendar dates at noon operational time (America/Mexico_City)', () => {
    const parsed = parseOperationalIncurredAt('2026-06-01');
    expect(parsed.toISOString()).toBe('2026-06-01T18:00:00.000Z');
  });

  it('adds calendar months for the next verification installment', () => {
    expect(addOperationalMonthsYmd('2026-02-27', 6)).toBe('2026-08-27');
    expect(addOperationalMonthsYmd('2026-08-31', 6)).toBe('2027-02-28');
    expect(addOperationalMonthsYmd('bad', 6)).toBeNull();
  });
});
