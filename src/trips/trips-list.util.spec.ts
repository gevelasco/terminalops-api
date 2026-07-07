import { applyTripListFilters } from './trips-list.util';

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

    expect(qb.andWhere).toHaveBeenCalledWith('trip.status = :status', {
      status: 'in_transit',
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
