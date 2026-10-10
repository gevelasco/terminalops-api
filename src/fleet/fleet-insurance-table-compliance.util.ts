import type { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  fmtMxDateYmd,
  renewalBucketFromTargetYmd,
  type FleetMetaLike,
} from './fleet-overview-maintenance.util';
import type {
  FleetTableInsuranceComplianceDto,
  FleetInsuranceTableComplianceResponseDto,
} from './dto/fleet-insurance-table-compliance.dto';
import type { FleetOverviewRenewalStatus } from './dto/fleet-overview.dto';

const INSURANCE_PAYMENT_CONFIRM_WINDOW_DAYS = 10;
const FLEET_COMPLIANCE_SOON_DAYS = 10;

export type FleetInsuranceComplianceMeta = Pick<
  FleetMetaLike,
  | 'insuranceContractDate'
  | 'insuranceLastPaymentDate'
  | 'insurancePaymentCadence'
> & {
  insurancePolicyNumber?: string | null;
};

type ScheduleRow = {
  dueDate: string;
  status: 'paid' | 'future' | 'due' | 'overdue';
};

function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday(today: Date): Date {
  const d = new Date(today.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function cadenceToMonths(cad: string | undefined): number {
  const raw = (cad ?? '').trim().toLowerCase();
  if (raw === 'weekly' || raw === 'semanal') {
    return 0;
  }
  if (raw === 'monthly' || raw === 'mensual') {
    return 1;
  }
  if (raw === 'quarterly' || raw === 'trimestral') {
    return 3;
  }
  if (raw === 'annual' || raw === 'anual') {
    return 12;
  }
  return 12;
}

function showInsurancePaymentSchedule(cadence: string | undefined): boolean {
  const months = cadenceToMonths(cadence);
  return months === 1 || months === 3;
}

function insurancePaymentAnchor(meta: FleetInsuranceComplianceMeta | undefined): string | null {
  const last = meta?.insuranceLastPaymentDate?.trim();
  if (last) {
    return last;
  }
  const contract = meta?.insuranceContractDate?.trim();
  return contract || null;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function nextInsurancePaymentDate(
  meta: FleetInsuranceComplianceMeta | undefined,
): Date | null {
  const iso = insurancePaymentAnchor(meta);
  if (!iso) {
    return null;
  }
  const start = parseYmd(iso);
  if (!start) {
    return null;
  }
  const months = cadenceToMonths(meta?.insurancePaymentCadence ?? undefined);
  return months === 0
    ? new Date(start.getTime() + 7 * 86400000)
    : addMonths(start, months);
}

function daysFromToday(target: Date, today: Date): number {
  const ms = target.getTime() - startOfToday(today).getTime();
  return Math.round(ms / 86400000);
}

function rowStatus(
  dueDate: string,
  paid: boolean,
  today: Date,
): ScheduleRow['status'] {
  if (paid) {
    return 'paid';
  }
  const due = parseYmd(dueDate);
  if (!due) {
    return 'future';
  }
  if (due.getTime() < startOfToday(today).getTime()) {
    return 'overdue';
  }
  const daysUntil = daysFromToday(due, today);
  return daysUntil <= INSURANCE_PAYMENT_CONFIRM_WINDOW_DAYS ? 'due' : 'future';
}

function buildInsuranceScheduleRows(
  expenses: readonly Expense[],
  cadenceMonths: number,
  today: Date,
): ScheduleRow[] {
  const sorted = [...expenses]
    .filter((e) => e.kind === 'insurance')
    .sort((a, b) => {
      const aDue = formatOperationalIncurredDateYmd(a.incurredAt);
      const bDue = formatOperationalIncurredDateYmd(b.incurredAt);
      return aDue.localeCompare(bDue) || a.id - b.id;
    });
  return sorted.map((expense) => {
    const dueDate = formatOperationalIncurredDateYmd(expense.incurredAt);
    const paid = expense.paidAt != null;
    return {
      dueDate,
      status: rowStatus(dueDate, paid, today),
    };
  });
}

function complianceFromSchedule(
  rows: readonly ScheduleRow[],
  today: Date,
): { bucket: 'ok' | 'soon' | 'due' } | null {
  if (rows.length === 0) {
    return null;
  }
  const nextUnpaid = rows.find((row) => row.status !== 'paid');
  if (!nextUnpaid) {
    return { bucket: 'ok' };
  }
  if (nextUnpaid.status === 'overdue') {
    return { bucket: 'due' };
  }
  if (nextUnpaid.status === 'due') {
    return { bucket: 'soon' };
  }
  return { bucket: 'ok' };
}

function nextUnpaidDueYmd(rows: readonly ScheduleRow[]): string | null {
  return rows.find((row) => row.status !== 'paid')?.dueDate ?? null;
}

function insuranceBucketFromMeta(
  meta: FleetInsuranceComplianceMeta | undefined,
  today: Date,
): FleetOverviewRenewalStatus {
  const policy = meta?.insurancePolicyNumber?.trim();
  const anchor = insurancePaymentAnchor(meta);
  if (!policy && !anchor) {
    return 'na';
  }
  if (!anchor) {
    return 'ok';
  }
  const next = nextInsurancePaymentDate(meta);
  if (!next) {
    return 'ok';
  }
  const d = daysFromToday(next, today);
  if (d < 0) {
    return 'due';
  }
  if (d <= FLEET_COMPLIANCE_SOON_DAYS) {
    return 'soon';
  }
  return 'ok';
}

export function computeFleetTableInsuranceCompliance(
  meta: FleetInsuranceComplianceMeta | undefined,
  expenses: readonly Expense[],
  today: Date = new Date(),
): FleetTableInsuranceComplianceDto {
  const policy = meta?.insurancePolicyNumber?.trim();
  const anchor = insurancePaymentAnchor(meta);
  if (!policy && !anchor) {
    return { renewal: 'na', nextLabel: null };
  }

  if (showInsurancePaymentSchedule(meta?.insurancePaymentCadence ?? undefined)) {
    const cadenceMonths = cadenceToMonths(meta?.insurancePaymentCadence ?? undefined);
    const rows = buildInsuranceScheduleRows(expenses, cadenceMonths, today);
    const schedule = complianceFromSchedule(rows, today);
    if (schedule) {
      const due = nextUnpaidDueYmd(rows);
      return {
        renewal: schedule.bucket,
        nextLabel: due ? fmtMxDateYmd(due) : null,
      };
    }
  }

  const renewal = insuranceBucketFromMeta(meta, today);
  const next = nextInsurancePaymentDate(meta);
  return {
    renewal,
    nextLabel: next ? fmtMxDateYmd(formatLocalYmd(next)) : null,
  };
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fleetInsuranceTableQueryRange(today = new Date()): {
  from: string;
  to: string;
} {
  const from = new Date(today.getTime());
  from.setMonth(from.getMonth() - 14);
  const to = new Date(today.getTime());
  to.setMonth(to.getMonth() + 14);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export function groupInsuranceExpensesByUnitId(
  expenses: readonly Expense[],
): Map<number, Expense[]> {
  const map = new Map<number, Expense[]>();
  for (const expense of expenses) {
    const id = expense.relatedUnitId;
    if (id == null || id <= 0) {
      continue;
    }
    const list = map.get(id) ?? [];
    list.push(expense);
    map.set(id, list);
  }
  return map;
}

export function groupInsuranceExpensesByEquipmentId(
  expenses: readonly Expense[],
): Map<number, Expense[]> {
  const map = new Map<number, Expense[]>();
  for (const expense of expenses) {
    const id = expense.relatedEquipmentId;
    if (id == null || id <= 0) {
      continue;
    }
    const list = map.get(id) ?? [];
    list.push(expense);
    map.set(id, list);
  }
  return map;
}

export function emptyInsuranceTableComplianceResponse(): FleetInsuranceTableComplianceResponseDto {
  return { units: {}, equipment: {} };
}
