import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import type { ExpenseMaintenanceTarget } from 'src/expenses/expense-payload.util';
import {
  buildInitialInsurancePremium,
  findNewInsurancePayments,
  INSURANCE_PAYMENT_EXPENSE_DESC_PREFIX,
  mergeInsuranceProfile,
  type InsurancePaymentCandidate,
  type InsuranceProfileLike,
} from './fleet-insurance-expense-sync.util';
import { resolveFleetCyclePaymentIncurredDate } from './fleet-payment-expense-date.util';

@Injectable()
export class FleetInsuranceExpenseSyncService {
  constructor(private readonly expensesService: ExpensesService) {}

  async syncForInsurancePaymentSave(params: {
    companyId: number;
    insuranceTarget: ExpenseMaintenanceTarget;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    previous: InsuranceProfileLike | null | undefined;
    incoming: InsuranceProfileLike;
  }): Promise<void> {
    const payments = findNewInsurancePayments(params.previous, params.incoming);
    for (const payment of payments) {
      await this.createInsuranceExpense({
        companyId: params.companyId,
        insuranceTarget: params.insuranceTarget,
        relatedUnitId: params.relatedUnitId,
        relatedEquipmentId: params.relatedEquipmentId,
        payment,
      });
    }
  }

  async ensureInitialInsurancePremium(params: {
    companyId: number;
    insuranceTarget: ExpenseMaintenanceTarget;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    previous: InsuranceProfileLike | null | undefined;
    incoming?: InsuranceProfileLike;
  }): Promise<boolean> {
    const merged = mergeInsuranceProfile(params.previous, params.incoming ?? {});
    const initial = buildInitialInsurancePremium(merged);
    if (!initial) {
      return false;
    }
    return this.createInsuranceExpense({
      companyId: params.companyId,
      insuranceTarget: params.insuranceTarget,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
      payment: initial,
    });
  }

  private async createInsuranceExpense(params: {
    companyId: number;
    insuranceTarget: ExpenseMaintenanceTarget;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    payment: InsurancePaymentCandidate;
  }): Promise<boolean> {
    const isCyclePayment = params.payment.description.startsWith(
      INSURANCE_PAYMENT_EXPENSE_DESC_PREFIX,
    );
    const incurredAt = isCyclePayment
      ? resolveFleetCyclePaymentIncurredDate(params.payment.date)
      : params.payment.date;
    const exists = await this.expensesService.hasFleetInsuranceExpenseWithDescription(
      params.companyId,
      {
        insuranceTarget: params.insuranceTarget,
        relatedUnitId: params.relatedUnitId,
        relatedEquipmentId: params.relatedEquipmentId,
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
      kind: 'insurance',
      insuranceTarget: params.insuranceTarget,
      relatedUnitId:
        params.relatedUnitId != null ? String(params.relatedUnitId) : undefined,
      relatedEquipmentId:
        params.relatedEquipmentId != null
          ? String(params.relatedEquipmentId)
          : undefined,
      description: params.payment.description,
      vendor: params.payment.vendor,
      paymentMethod: params.payment.paymentMethod,
      invoiceRequired: params.payment.invoiceRequired,
    });
    return true;
  }
}
