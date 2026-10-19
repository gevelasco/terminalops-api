import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import {
  canConfirmOperatorTripPayment,
  summarizeOperatorTripPaymentLedger,
} from './operator-trip-payment-confirm.util';

function trip(partial: Partial<Trip> & Pick<Trip, 'id'>): Trip {
  return {
    status: 'completed',
    operatorQuota: '1000',
    ...partial,
  } as Trip;
}

function expense(partial: Partial<Expense>): Expense {
  return {
    kind: 'operator_payment',
    amount: '500',
    discardedAt: null,
    paidAt: null,
    ...partial,
  } as Expense;
}

describe('operator-trip-payment-confirm.util', () => {
  it('blocks confirm when quota is zero but a ledger row exists', () => {
    const ledger = summarizeOperatorTripPaymentLedger(
      trip({ id: 4, operatorQuota: '0' }),
      [expense({ tripId: 4, amount: '1500' })],
      4,
    );
    expect(canConfirmOperatorTripPayment(trip({ id: 4, operatorQuota: '0' }), ledger)).toBe(
      false,
    );
  });

  it('allows confirm when quota exceeds paid amount', () => {
    const ledger = summarizeOperatorTripPaymentLedger(
      trip({ id: 28, operatorQuota: '3000' }),
      [expense({ tripId: 28, amount: '3000', paidAt: null })],
      28,
    );
    expect(ledger.balance).toBe(3000);
    expect(canConfirmOperatorTripPayment(trip({ id: 28 }), ledger)).toBe(true);
  });
});
