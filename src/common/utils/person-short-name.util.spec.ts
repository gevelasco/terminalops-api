import { formatPersonShortName } from './person-short-name.util';

describe('formatPersonShortName', () => {
  it('returns empty for blank', () => {
    expect(formatPersonShortName('')).toBe('');
    expect(formatPersonShortName('   ')).toBe('');
    expect(formatPersonShortName(null)).toBe('');
  });

  it('keeps a single name', () => {
    expect(formatPersonShortName('Juan')).toBe('Juan');
  });

  it('keeps first name and first apellido when two tokens', () => {
    expect(formatPersonShortName('Juan Pérez')).toBe('Juan Pérez');
  });

  it('uses first name and paternal apellido for three or more tokens', () => {
    expect(formatPersonShortName('Juan Pérez García')).toBe('Juan Pérez');
    expect(formatPersonShortName('Juan Carlos Pérez García')).toBe('Juan Pérez');
  });
});
