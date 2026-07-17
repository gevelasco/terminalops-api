import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import type { ExpenseMaintenanceTarget } from 'src/expenses/expense-payload.util';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  buildInsurancePaymentExpenseDescription,
  insurancePolicyConceptLabel,
  type InsuranceProfileLike,
  mergeInsuranceProfile,
} from './fleet-insurance-expense-sync.util';
import {
  cadenceToMonths,
  coverageSchedulePeriodCount,
} from './fleet-coverage-payment-period.util';
import type { CreateExpenseDto } from 'src/expenses/dto/create-expense.dto';

function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function policyYearStart(contractDate: Date, referenceDate: Date): Date {
  const elapsed =
    (referenceDate.getFullYear() - contractDate.getFullYear()) * 12 +
    (referenceDate.getMonth() - contractDate.getMonth());
  const yearIndex = Math.max(0, Math.floor(elapsed / 12));
  return addMonths(contractDate, yearIndex * 12);
}

function parsePositiveCost(
  raw: string | number | null | undefined,
): number | null {
  if (raw == null || raw === '') return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

@Injectable()
export class FleetInsuranceExpenseSyncService {
  constructor(private readonly expensesService: ExpensesService) {}

  async ensureAllInsuranceInstallments(params: {
    companyId: number;
    insuranceTarget: ExpenseMaintenanceTarget;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    profile: InsuranceProfileLike;
  }): Promise<void> {
    const {
      companyId,
      insuranceTarget,
      relatedUnitId,
      relatedEquipmentId,
      profile,
    } = params;

    const dueDates = this.buildFullScheduleDueDates(profile);
    if (dueDates.length === 0) return;

    const cost = parsePositiveCost(profile.insuranceCost);
    if (cost == null) return;

    // Descartar y regenerar el calendario de pólizas de forma atómica.
    await this.expensesService.runInTransaction(async (manager) => {
      const existing = await this.expensesService.findScheduledExpenses(
        companyId,
        'insurance',
        { relatedUnitId, relatedEquipmentId, insuranceTarget },
        manager,
      );

      const paidByDate = new Map<string, true>();
      for (const e of existing) {
        if (e.paidAt != null) {
          paidByDate.set(formatOperationalIncurredDateYmd(e.incurredAt), true);
        }
      }

      await this.expensesService.discardUnpaidScheduledExpenses(
        companyId,
        'insurance',
        { relatedUnitId, relatedEquipmentId, insuranceTarget },
        manager,
      );

      const cadence = (profile.insurancePaymentCadence ?? '').trim();
      const carrier = (profile.insuranceCarrierName ?? '').trim() || undefined;
      const paymentMethod =
        (profile.insurancePaymentMethod ?? '').trim() || undefined;
      const invoiceRequired = profile.insuranceInvoiceRequired === true;
      const category = insurancePolicyConceptLabel(cadence);

      const drafts: Array<CreateExpenseDto & { paidAt?: string | null }> = [];

      for (const dueDate of dueDates) {
        if (paidByDate.has(dueDate)) continue;

        const description = buildInsurancePaymentExpenseDescription(
          profile,
          dueDate,
        );

        drafts.push({
          category,
          amount: cost,
          incurredAt: dueDate,
          kind: 'insurance',
          insuranceTarget,
          relatedUnitId:
            relatedUnitId != null ? String(relatedUnitId) : undefined,
          relatedEquipmentId:
            relatedEquipmentId != null ? String(relatedEquipmentId) : undefined,
          description,
          vendor: carrier,
          paymentMethod,
          invoiceRequired,
          paidAt: null,
        });
      }

      await this.expensesService.bulkCreateScheduledExpenses(
        companyId,
        drafts,
        manager,
      );
    });
  }

  private buildFullScheduleDueDates(profile: InsuranceProfileLike): string[] {
    const contract = (profile.insuranceContractDate ?? '').trim();
    if (!contract) return [];

    const cadence = (profile.insurancePaymentCadence ?? '').trim();
    const cadenceMonths = cadenceToMonths(cadence);
    const periodCount = coverageSchedulePeriodCount(cadence);

    if (periodCount > 0) {
      const contractDate = parseYmd(contract);
      if (!contractDate) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yearStart = policyYearStart(contractDate, today);
      const stepMonths = cadenceMonths === 1 ? 1 : 3;
      const dates: string[] = [];
      for (let i = 0; i < periodCount; i++) {
        dates.push(formatYmd(addMonths(yearStart, i * stepMonths)));
      }
      return dates;
    }

    if (cadenceMonths === 12) {
      const contractDate = parseYmd(contract);
      if (!contractDate) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yearStart = policyYearStart(contractDate, today);
      return [formatYmd(yearStart)];
    }

    return [];
  }

  /** @deprecated Use ensureAllInsuranceInstallments instead. Kept for backward compat during transition. */
  async syncForInsurancePaymentSave(params: {
    companyId: number;
    insuranceTarget: ExpenseMaintenanceTarget;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    previous: InsuranceProfileLike | null | undefined;
    incoming: InsuranceProfileLike;
  }): Promise<void> {
    const merged = mergeInsuranceProfile(params.previous, params.incoming);
    await this.ensureAllInsuranceInstallments({
      companyId: params.companyId,
      insuranceTarget: params.insuranceTarget,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
      profile: merged,
    });
  }

  /** @deprecated Use ensureAllInsuranceInstallments instead. */
  async ensureInitialInsurancePremium(params: {
    companyId: number;
    insuranceTarget: ExpenseMaintenanceTarget;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    previous: InsuranceProfileLike | null | undefined;
    incoming?: InsuranceProfileLike;
  }): Promise<boolean> {
    const merged = mergeInsuranceProfile(
      params.previous,
      params.incoming ?? {},
    );
    await this.ensureAllInsuranceInstallments({
      companyId: params.companyId,
      insuranceTarget: params.insuranceTarget,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
      profile: merged,
    });
    return true;
  }
}
