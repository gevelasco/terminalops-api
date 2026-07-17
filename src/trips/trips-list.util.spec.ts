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
  it('includes maneuver code and route fields when q is set', () => {
    const qb = createQueryBuilderMock();
    applyTripListFilters(qb as never, 1, { q: 'CHI-0006' });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('trip.maneuver_code ILIKE :q'),
      { q: '%CHI-0006%', companyId: 1 },
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
