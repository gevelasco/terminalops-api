import { Injectable } from '@nestjs/common';
import { ExpensesService } from 'src/expenses/expenses.service';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  buildGpsPaymentExpenseDescription,
  gpsServiceConceptLabel,
  mergeGpsProfile,
  type GpsProfileLike,
} from './fleet-gps-expense-sync.util';
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
export class FleetGpsExpenseSyncService {
  constructor(private readonly expensesService: ExpensesService) {}

  async ensureAllGpsInstallments(params: {
    companyId: number;
    relatedUnitId: number;
    profile: GpsProfileLike;
  }): Promise<void> {
    const { companyId, relatedUnitId, profile } = params;

    if (profile.hasGps === false) return;

    const dueDates = this.buildFullScheduleDueDates(profile);
    if (dueDates.length === 0) return;

    const cost = parsePositiveCost(profile.gpsPrice);
    if (cost == null) return;

    // Descartar y regenerar el calendario de GPS de forma atómica.
    await this.expensesService.runInTransaction(async (manager) => {
      const existing = await this.expensesService.findScheduledExpenses(
        companyId,
        'gps',
        { relatedUnitId },
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
        'gps',
        { relatedUnitId },
        manager,
      );

      const cadence = (profile.gpsPaymentCadence ?? '').trim();
      const provider = (profile.gpsProviderBrand ?? '').trim() || undefined;
      const paymentMethod =
        (profile.gpsPaymentMethod ?? '').trim() || undefined;
      const invoiceRequired = profile.gpsInvoiceRequired === true;
      const category = gpsServiceConceptLabel(cadence);

      const drafts: Array<CreateExpenseDto & { paidAt?: string | null }> = [];

      for (const dueDate of dueDates) {
        if (paidByDate.has(dueDate)) continue;

        const description = buildGpsPaymentExpenseDescription(profile, dueDate);

        drafts.push({
          category,
          amount: cost,
          incurredAt: dueDate,
          kind: 'gps',
          relatedUnitId: String(relatedUnitId),
          description,
          vendor: provider,
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

  private buildFullScheduleDueDates(profile: GpsProfileLike): string[] {
    const contract = (profile.gpsContractDate ?? '').trim();
    if (!contract) return [];

    const cadence = (profile.gpsPaymentCadence ?? '').trim();
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

  /** @deprecated Use ensureAllGpsInstallments instead. */
  async syncForGpsPaymentSave(params: {
    companyId: number;
    relatedUnitId: number;
    previous: GpsProfileLike | null | undefined;
    incoming: GpsProfileLike;
  }): Promise<void> {
    const merged = mergeGpsProfile(params.previous, params.incoming);
    await this.ensureAllGpsInstallments({
      companyId: params.companyId,
      relatedUnitId: params.relatedUnitId,
      profile: merged,
    });
  }

  /** @deprecated Use ensureAllGpsInstallments instead. */
  async ensureInitialGpsService(params: {
    companyId: number;
    relatedUnitId: number;
    previous: GpsProfileLike | null | undefined;
    incoming?: GpsProfileLike;
  }): Promise<boolean> {
    const merged = mergeGpsProfile(params.previous, params.incoming ?? {});
    await this.ensureAllGpsInstallments({
      companyId: params.companyId,
      relatedUnitId: params.relatedUnitId,
      profile: merged,
    });
    return true;
  }
}
