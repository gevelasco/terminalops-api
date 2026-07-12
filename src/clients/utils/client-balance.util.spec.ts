import {
  buildClientBalanceSummary,
  deriveClientCommercialHealthFromSummary,
} from './client-balance.util';
import type {
  ClientBalanceExpenseRow,
  ClientBalanceTripRow,
} from './client-balance-trip.util';

function trip(
  partial: Partial<ClientBalanceTripRow> & Pick<ClientBalanceTripRow, 'id' | 'clientId'>,
): ClientBalanceTripRow {
  return {
    maneuverCode: 'TST-001',
    status: 'completed',
    hasClientBilling: true,
    falseManeuver: false,
    clientCharge: '10000',
    clientCollectedAt: null,
    creditDays: 15,
    dieselAmount: '1000',
    casetasAmount: '0',
    operatorQuota: '0',
    perDiemAmount: '0',
    operationalDistanceKm: 120,
    returnAt: '2026-06-01T18:00:00.000Z',
    plannedCompletionAt: '2026-06-01T18:00:00.000Z',
    ...partial,
  };
}

describe('client-balance.util', () => {
  it('calcula cartera pendiente y estatus comercial', () => {
    const trips: ClientBalanceTripRow[] = [
      trip({ id: '1', clientId: '7', clientCharge: '5000' }),
    ];
    const summary = buildClientBalanceSummary(
      '7',
      trips,
      [],
      new Date('2026-06-10T12:00:00.000Z'),
    );

    expect(summary.receivable).toBe(5000);
    expect(summary.collected).toBe(0);
    expect(deriveClientCommercialHealthFromSummary(summary)).toBe('good_standing');
  });

  it('usa gastos de ledger cuando cubren rubros programados', () => {
    const trips: ClientBalanceTripRow[] = [
      trip({
        id: '2',
        clientId: '8',
        clientCollectedAt: '2026-06-10T12:00:00.000Z',
      }),
    ];
    const expenses: ClientBalanceExpenseRow[] = [
      { tripId: '2', kind: 'fuel', amount: 2500 },
    ];
    const summary = buildClientBalanceSummary('8', trips, expenses);

    expect(summary.directCost).toBe(2500);
    expect(summary.collected).toBe(10000);
  });
});
