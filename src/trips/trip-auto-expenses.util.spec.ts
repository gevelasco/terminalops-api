import { buildTripAutoExpenses, resolveTripTotalCost } from './trip-auto-expenses.util';
import type { Trip } from 'src/trips/entities/trip.entity';

function tripStub(partial: Partial<Trip>): Trip {
  return {
    id: 1,
    companyId: 1,
    maneuverCode: 'ACME-001',
    createdAt: new Date('2026-06-10T16:00:00.000Z'),
    ...partial,
  } as Trip;
}

describe('trip-auto-expenses.util', () => {
  it('resolveTripTotalCost uses clientCharge', () => {
    expect(resolveTripTotalCost(tripStub({ clientCharge: '10,000.50' }))).toBe(
      10000.5,
    );
  });

  it('buildTripAutoExpenses creates four expense drafts from trip amounts', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        dieselAmount: '2500',
        casetasAmount: '800',
        operatorQuota: '1200',
        clientCharge: '20000',
        unitId: 3,
        operatorId: 7,
      }),
    );

    expect(drafts).toHaveLength(4);
    expect(drafts.map((d) => d.kind)).toEqual([
      'fuel',
      'tolls',
      'operator_payment',
      'maintenance',
    ]);
    expect(drafts.find((d) => d.kind === 'maintenance')?.amount).toBe('1000.00');
    expect(drafts.find((d) => d.kind === 'operator_payment')?.relatedOperatorId).toBe(
      7,
    );
  });

  it('skips zero-amount expense rows', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        dieselAmount: '0',
        casetasAmount: '',
        operatorQuota: '500',
        clientCharge: '0',
      }),
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.kind).toBe('operator_payment');
  });
});
