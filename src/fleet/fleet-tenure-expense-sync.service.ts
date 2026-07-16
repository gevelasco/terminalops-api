import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  coveragePaymentPeriodLabel,
  cadenceToMonths,
} from './fleet-coverage-payment-period.util';
import type { CreateExpenseDto } from 'src/expenses/dto/create-expense.dto';

export type TenurePaymentProfileLike = {
  recurringPaymentAmount?: string | number | null;
  recurringPaymentCadence?: string | null;
  recurringPaymentDate?: string | null;
  recurringLastPaymentDate?: string | null;
  recurringInstallmentCount?: number | null;
  tenureBeneficiary?: string | null;
};

const TENURE_PAYMENT_DESC_PREFIX = 'Cuota de financiamiento';

function tenureConceptLabel(cadence: string | undefined): string {
  const months = cadenceToMonths(cadence);
  if (months === 1) return 'Financiamiento - mensual';
  if (months === 3) return 'Financiamiento - trimestral';
  if (months === 12) return 'Financiamiento - anual';
  return 'Financiamiento';
}

function parsePositiveCost(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

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

@Injectable()
export class FleetTenureExpenseSyncService {
  constructor(private readonly expensesService: ExpensesService) {}

  async ensureAllTenureInstallments(params: {
    companyId: number;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    profile: TenurePaymentProfileLike;
  }): Promise<void> {
    const { companyId, relatedUnitId, relatedEquipmentId, profile } = params;

    const startDate = (profile.recurringPaymentDate ?? '').toString().trim();
    if (!startDate) return;

    const cost = parsePositiveCost(profile.recurringPaymentAmount);
    if (cost == null) return;

    const totalInstallments = profile.recurringInstallmentCount ?? 0;
    if (totalInstallments <= 0) return;

    const cadence = (profile.recurringPaymentCadence ?? '').toString().trim();
    const stepMonths = cadenceToMonths(cadence);
    if (stepMonths === 0) return;

    const startParsed = parseYmd(startDate);
    if (!startParsed) return;

    const existing = await this.expensesService.findScheduledExpenses(
      companyId,
      'tenure_payment',
      { relatedUnitId, relatedEquipmentId },
    );

    const paidByDate = new Map<string, true>();
    for (const e of existing) {
      if (e.paidAt != null) {
        paidByDate.set(formatOperationalIncurredDateYmd(e.incurredAt), true);
      }
    }

    await this.expensesService.discardUnpaidScheduledExpenses(
      companyId,
      'tenure_payment',
      { relatedUnitId, relatedEquipmentId },
    );

    const vendor = (profile.tenureBeneficiary ?? '').toString().trim() || undefined;
    const category = tenureConceptLabel(cadence);

    const drafts: Array<CreateExpenseDto & { paidAt?: string | null }> = [];

    for (let i = 0; i < totalInstallments; i++) {
      const dueDate = formatYmd(addMonths(startParsed, i * stepMonths));
      if (paidByDate.has(dueDate)) continue;

      const periodLabel = coveragePaymentPeriodLabel(cadence, startDate, dueDate);
      const description = periodLabel
        ? `${TENURE_PAYMENT_DESC_PREFIX} (${periodLabel})`
        : `${TENURE_PAYMENT_DESC_PREFIX} (${i + 1}/${totalInstallments})`;

      drafts.push({
        category,
        amount: cost,
        incurredAt: dueDate,
        kind: 'tenure_payment',
        relatedUnitId: relatedUnitId != null ? String(relatedUnitId) : undefined,
        relatedEquipmentId: relatedEquipmentId != null ? String(relatedEquipmentId) : undefined,
        description,
        vendor,
        paidAt: null,
      });
    }

    await this.expensesService.bulkCreateScheduledExpenses(companyId, drafts);
  }

  /** @deprecated Use ensureAllTenureInstallments instead. */
  async syncForTenurePaymentSave(params: {
    companyId: number;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    previous: TenurePaymentProfileLike | null | undefined;
    incoming: TenurePaymentProfileLike;
  }): Promise<void> {
    const profile: TenurePaymentProfileLike = {
      recurringPaymentAmount:
        params.incoming.recurringPaymentAmount ?? params.previous?.recurringPaymentAmount,
      recurringPaymentCadence:
        params.incoming.recurringPaymentCadence ?? params.previous?.recurringPaymentCadence,
      recurringPaymentDate:
        params.incoming.recurringPaymentDate ?? params.previous?.recurringPaymentDate,
      recurringLastPaymentDate:
        params.incoming.recurringLastPaymentDate ?? params.previous?.recurringLastPaymentDate,
      recurringInstallmentCount:
        params.incoming.recurringInstallmentCount ?? params.previous?.recurringInstallmentCount,
      tenureBeneficiary:
        params.incoming.tenureBeneficiary ?? params.previous?.tenureBeneficiary,
    };
    await this.ensureAllTenureInstallments({
      companyId: params.companyId,
      relatedUnitId: params.relatedUnitId,
      relatedEquipmentId: params.relatedEquipmentId,
      profile,
    });
  }
}
