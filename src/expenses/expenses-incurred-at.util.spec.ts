import { parseOperationalIncurredAt } from './expenses-incurred-at.util';

describe('expenses-incurred-at.util', () => {
  it('parses calendar dates at noon operational time (America/Mexico_City)', () => {
    const parsed = parseOperationalIncurredAt('2026-06-01');
    expect(parsed.toISOString()).toBe('2026-06-01T18:00:00.000Z');
  });

  it('keeps full ISO timestamps unchanged', () => {
    const iso = '2026-06-01T08:30:00.000Z';
    expect(parseOperationalIncurredAt(iso).toISOString()).toBe(iso);
  });
});
