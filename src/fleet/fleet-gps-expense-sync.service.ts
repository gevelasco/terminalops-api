import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import {
  buildInitialGpsService,
  findNewGpsPayments,
  GPS_PAYMENT_EXPENSE_DESC_PREFIX,
  mergeGpsProfile,
  type GpsPaymentCandidate,
  type GpsProfileLike,
} from './fleet-gps-expense-sync.util';
import { resolveFleetCyclePaymentIncurredDate } from './fleet-payment-expense-date.util';

@Injectable()
export class FleetGpsExpenseSyncService {
  constructor(private readonly expensesService: ExpensesService) {}

  async syncForGpsPaymentSave(params: {
    companyId: number;
    relatedUnitId: number;
    previous: GpsProfileLike | null | undefined;
    incoming: GpsProfileLike;
  }): Promise<void> {
    const payments = findNewGpsPayments(params.previous, params.incoming);
    for (const payment of payments) {
      await this.createGpsExpense({
        companyId: params.companyId,
        relatedUnitId: params.relatedUnitId,
        payment,
      });
    }
  }

  async ensureInitialGpsService(params: {
    companyId: number;
    relatedUnitId: number;
    previous: GpsProfileLike | null | undefined;
    incoming?: GpsProfileLike;
  }): Promise<boolean> {
    const merged = mergeGpsProfile(params.previous, params.incoming ?? {});
    const initial = buildInitialGpsService(merged);
    if (!initial) {
      return false;
    }
    return this.createGpsExpense({
      companyId: params.companyId,
      relatedUnitId: params.relatedUnitId,
      payment: initial,
    });
  }

  private async createGpsExpense(params: {
    companyId: number;
    relatedUnitId: number;
    payment: GpsPaymentCandidate;
  }): Promise<boolean> {
    const isCyclePayment = params.payment.description.startsWith(
      GPS_PAYMENT_EXPENSE_DESC_PREFIX,
    );
    const incurredAt = isCyclePayment
      ? resolveFleetCyclePaymentIncurredDate(params.payment.date)
      : params.payment.date;
    const exists = await this.expensesService.hasFleetGpsExpenseWithDescription(
      params.companyId,
      {
        relatedUnitId: params.relatedUnitId,
        description: params.payment.description,
      },
    );
    if (exists) {
      return false;
    }
    await this.expensesService.create(params.companyId, {
      category: params.payment.category,
      amount: params.payment.cost,
      incurredAt,
      kind: 'gps',
      relatedUnitId: String(params.relatedUnitId),
      description: params.payment.description,
      vendor: params.payment.vendor,
      paymentMethod: params.payment.paymentMethod,
      invoiceRequired: params.payment.invoiceRequired,
    });
    return true;
  }
}
