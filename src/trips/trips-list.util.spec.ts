import {
  applyTripListFilters,
  normalizeTripListLimit,
  TRIP_LIST_DEFAULT_LIMIT,
} from './trips-list.util';
import { parseTripListStatusFilter } from './dto/list-trips-query.dto';

describe('normalizeTripListLimit', () => {
  it.each([undefined, 0, -1, 101, 12])(
    'uses the safe default for %s',
    (limit) => {
      expect(normalizeTripListLimit(limit)).toBe(TRIP_LIST_DEFAULT_LIMIT);
    },
  );

  it.each([10, 15, 25, 50, 100])('accepts the supported limit %s', (limit) => {
    expect(normalizeTripListLimit(limit)).toBe(limit);
  });
});

describe('parseTripListStatusFilter', () => {
  it('returns empty for missing or blank status', () => {
    expect(parseTripListStatusFilter(undefined)).toEqual([]);
    expect(parseTripListStatusFilter('  ')).toEqual([]);
  });

  it('parses a single status', () => {
    expect(parseTripListStatusFilter('completed')).toEqual(['completed']);
  });

  it('parses comma-separated statuses, dedupes and drops invalid values', () => {
    expect(
      parseTripListStatusFilter('scheduled, in_transit,scheduled,bogus'),
    ).toEqual(['scheduled', 'in_transit']);
  });
});
function createQueryBuilderMock() {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
  };
  return qb;
}

describe('applyTripListFilters search', () => {
  it('uses prefix + unit_id IN for maneuver-like codes', () => {
    const qb = createQueryBuilderMock();
    applyTripListFilters(qb as never, 1, { q: 'CHI-0006' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('trip.maneuver_code ILIKE :qPrefix'),
      expect.objectContaining({
        qPrefix: 'CHI-0006%',
        companyId: 1,
      }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('trip.unit_id IN'),
      expect.objectContaining({ qPrefix: 'CHI-0006%' }),
    );
  });

  it('resolves a composite unit code via unit_id, not a trip-wide ILIKE', () => {
    const qb = createQueryBuilderMock();
    applyTripListFilters(qb as never, 1, { q: 'VOL-2021-12-AB-98L' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('trip.unit_id IN'),
      expect.objectContaining({
        qPrefix: 'VOL-2021-12-AB-98L%',
        qContains: '%VOL-2021-12-AB-98L%',
        companyId: 1,
      }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('CONCAT_WS'),
      expect.anything(),
    );
    const searchSql = String(
      qb.andWhere.mock.calls.find(([sql]) =>
        String(sql).includes('unit_id IN'),
      )?.[0],
    );
    expect(searchSql).not.toContain('client_name');
    expect(searchSql).not.toContain('CAST(');
  });

  it('keeps contains search for free text like operator names', () => {
    const qb = createQueryBuilderMock();
    applyTripListFilters(qb as never, 1, { q: 'Juan Perez' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('trip.client_name ILIKE :q'),
      expect.objectContaining({ q: '%Juan Perez%', companyId: 1 }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('trip.operator_id IN'),
      expect.anything(),
    );
  });

  it('filters by status when provided', () => {
    const qb = createQueryBuilderMock();
    applyTripListFilters(qb as never, 1, { status: 'in_transit' });

    expect(qb.andWhere).toHaveBeenCalledWith('trip.status IN (:...statuses)', {
      statuses: ['in_transit'],
    });
  });

  it('filters by multiple comma-separated statuses', () => {
    const qb = createQueryBuilderMock();
    applyTripListFilters(qb as never, 1, { status: 'scheduled,in_transit' });

    expect(qb.andWhere).toHaveBeenCalledWith('trip.status IN (:...statuses)', {
      statuses: ['scheduled', 'in_transit'],
    });
  });

  it('does not add text search clause when q is empty', () => {
    const qb = createQueryBuilderMock();
    applyTripListFilters(qb as never, 1, { q: '   ' });

    const searchCalls = qb.andWhere.mock.calls.filter(([sql]) =>
      String(sql).includes('maneuver_code ILIKE'),
    );
    expect(searchCalls).toHaveLength(0);
  });
});
