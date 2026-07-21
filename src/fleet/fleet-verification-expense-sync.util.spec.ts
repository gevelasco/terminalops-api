import { findNewBillableVerificationEvents } from './fleet-verification-expense-sync.util';

describe('fleet-verification-expense-sync.util', () => {
  it('creates candidate when verification date changes with cost', () => {
    expect(
      findNewBillableVerificationEvents(
        { verificationPhysMechDate: '2025-01-10', verificationPhysMechCost: '800' },
        { verificationPhysMechDate: '2026-06-01', verificationPhysMechCost: 1200 },
      ),
    ).toEqual([
      {
        scope: 'phys_mech',
        date: '2026-06-01',
        cost: 1200,
        category: 'Verificación - físico-mecánica',
      },
    ]);
  });

  it('skips when date unchanged or cost missing', () => {
    expect(
      findNewBillableVerificationEvents(
        { verificationPhysMechDate: '2026-06-01' },
        { verificationPhysMechDate: '2026-06-01', verificationPhysMechCost: 1200 },
      ),
    ).toEqual([]);

    expect(
      findNewBillableVerificationEvents(
        null,
        { verificationPhysMechDate: '2026-06-01' },
      ),
    ).toEqual([]);
  });

  it('limits equipment scopes to phys_mech', () => {
    expect(
      findNewBillableVerificationEvents(
        null,
        {
          verificationPhysMechDate: '2026-06-01',
          verificationPhysMechCost: 900,
          verificationEmissionsDate: '2026-06-01',
          verificationEmissionsCost: 500,
        },
        ['phys_mech'],
      ),
    ).toHaveLength(1);
  });
});
