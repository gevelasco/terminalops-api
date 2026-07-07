import { parseAvailableQuery } from './fleet-available-list.util';

describe('parseAvailableQuery', () => {
  it('returns false for missing or empty values', () => {
    expect(parseAvailableQuery(undefined)).toBe(false);
    expect(parseAvailableQuery('')).toBe(false);
    expect(parseAvailableQuery('   ')).toBe(false);
    expect(parseAvailableQuery('false')).toBe(false);
  });

  it('returns true for affirmative query values', () => {
    expect(parseAvailableQuery('true')).toBe(true);
    expect(parseAvailableQuery('TRUE')).toBe(true);
    expect(parseAvailableQuery('1')).toBe(true);
    expect(parseAvailableQuery('yes')).toBe(true);
  });
});
