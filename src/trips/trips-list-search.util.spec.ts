import {
  isTripListCodeSearch,
  normalizeTripListSearchNeedle,
  tripListCodeSearchSql,
  tripListContainsSearchSql,
  tripListSearchParams,
} from './trips-list-search.util';

describe('normalizeTripListSearchNeedle', () => {
  it('turns plate spaces into hyphens', () => {
    expect(normalizeTripListSearchNeedle('VOL-2021-12 AB 98L')).toBe(
      'VOL-2021-12-AB-98L',
    );
  });
});

describe('isTripListCodeSearch', () => {
  it.each([
    'VOL-2021-12-AB-98L',
    'vol-2021-12-ab-98l',
    'VOL-2021-12 AB 98L',
    'VOL 2021 12 AB 98L',
    'VOL-2021',
    '12-AB-98L',
    'CHI-0006',
  ])('treats %s as an indexed code search', (q) => {
    expect(isTripListCodeSearch(q)).toBe(true);
  });

  it.each(['incidente', 'Juan Perez', 'VOL', '98L', 'Guadalajara'])(
    'keeps %s on the general contains search',
    (q) => {
      expect(isTripListCodeSearch(q)).toBe(false);
    },
  );
});

describe('trip list search SQL', () => {
  it('code search uses unit_id IN and a prefix, not date casts', () => {
    const sql = tripListCodeSearchSql();
    expect(sql).toContain('trip.unit_id IN');
    expect(sql).toContain('trip.maneuver_code ILIKE :qPrefix');
    expect(sql).toContain('CONCAT_WS');
    expect(sql).not.toContain('CAST(');
    expect(sql).not.toContain('departure_at');
  });

  it('contains search resolves fleet via IN, not correlated EXISTS', () => {
    const sql = tripListContainsSearchSql();
    expect(sql).toContain('trip.unit_id IN');
    expect(sql).toContain('trip.operator_id IN');
    expect(sql).not.toContain('EXISTS');
    expect(sql).not.toContain('CAST(');
  });

  it('passes prefix and contains needles for an operational code', () => {
    expect(tripListSearchParams('VOL-2021-12-AB-98L', 7)).toEqual({
      q: '%VOL-2021-12-AB-98L%',
      qPrefix: 'VOL-2021-12-AB-98L%',
      qContains: '%VOL-2021-12-AB-98L%',
      companyId: 7,
    });
  });
});
