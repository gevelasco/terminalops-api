import {
  normalizeResourceListLimit,
  normalizeResourceListPage,
  RESOURCE_LIST_ALLOWED_LIMITS,
  RESOURCE_LIST_DEFAULT_LIMIT,
} from './list-resource-page-query.dto';

describe('normalizeResourceListLimit', () => {
  it.each([undefined, 0, 7, 999])(
    'falls back to default for invalid limit %s',
    (limit) => {
      expect(normalizeResourceListLimit(limit)).toBe(RESOURCE_LIST_DEFAULT_LIMIT);
    },
  );

  it.each([...RESOURCE_LIST_ALLOWED_LIMITS])(
    'accepts the supported limit %s',
    (limit) => {
      expect(normalizeResourceListLimit(limit)).toBe(limit);
    },
  );

  it('normalizes page to at least 1', () => {
    expect(normalizeResourceListPage(undefined)).toBe(1);
    expect(normalizeResourceListPage(0)).toBe(1);
    expect(normalizeResourceListPage(-3)).toBe(1);
    expect(normalizeResourceListPage(4)).toBe(4);
  });
});
