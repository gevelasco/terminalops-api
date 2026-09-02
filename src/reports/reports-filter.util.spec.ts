import { applyReportsTripScope, type ReportsScope } from './reports-filter.util';

const scope = (over: Partial<ReportsScope> = {}): ReportsScope => ({
  companyId: 7,
  from: '2026-01-01',
  to: '2026-01-31',
  clientIds: [],
  paymentMethods: [],
  ...over,
});

function createQueryBuilderMock() {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
  };
  return qb;
}

describe('applyReportsTripScope', () => {
  it('always excludes soft-deleted trips', () => {
    const qb = createQueryBuilderMock();
    applyReportsTripScope(qb, scope());

    expect(qb.andWhere).toHaveBeenCalledWith('trip.companyId = :companyId', {
      companyId: 7,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('trip.deleted_at IS NULL');
  });

  it('does not invent client or payment filters when empty', () => {
    const qb = createQueryBuilderMock();
    applyReportsTripScope(qb, scope());

    const sql = qb.andWhere.mock.calls.map(([fragment]) => String(fragment));
    expect(sql.some((s) => s.includes('clientId'))).toBe(false);
    expect(sql.some((s) => s.includes('paymentMethod'))).toBe(false);
  });
});
