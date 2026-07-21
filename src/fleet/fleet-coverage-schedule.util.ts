import type { Expense } from 'src/expenses/entities/expense.entity';
import {
  cadenceToMonths,
  coverageSchedulePeriodCount,
} from './fleet-coverage-payment-period.util';
import {
  fleetCycleIsPaid,
  fleetPaymentExpenseForCycle,
} from './fleet-payment-schedule-match.util';

export type CoverageScheduleRowStatus = 'paid' | 'future' | 'due' | 'overdue';

export type CoverageScheduleRow = {
  index: number;
  dueDate: string;
  status: CoverageScheduleRowStatus;
  paid: boolean;
  /** Hay gasto en ledger para el ciclo (pagado o no). */
  hasExpense: boolean;
};

export type FleetCoveragePaymentMeta = {
  contractDate?: string | null;
  lastPaymentDate?: string | null;
  cadence?: string | null;
};

function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function startOfToday(today: Date): Date {
  const d = new Date(today.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addCadenceStep(anchorYmd: string, cadence: string | undefined): string | null {
  const start = parseYmd(anchorYmd);
  if (!start) {
    return null;
  }
  const months = cadenceToMonths(cadence);
  const next =
    months === 0
      ? new Date(start.getTime() + 7 * 86400000)
      : addMonths(start, months);
  return formatYmd(next);
}

export function isInsurancePaymentExpense(e: Expense): boolean {
  const desc = (e.description ?? '').trim();
  return (
    e.kind === 'insurance' &&
    (desc.startsWith('Pago de póliza') || desc.startsWith('Contratación de póliza'))
  );
}

export function isGpsPaymentExpense(e: Expense): boolean {
  const desc = (e.description ?? '').trim();
  return (
    e.kind === 'gps' &&
    (desc.startsWith('Pago de GPS') || desc.startsWith('Contratación de GPS'))
  );
}

/** Calendario anual mensual/trimestral (misma lógica que la app de flota). */
export function buildCoveragePaymentSchedule(params: {
  meta: FleetCoveragePaymentMeta | undefined;
  expenses: readonly Expense[];
  expensePredicate: (expense: Expense) => boolean;
  today?: Date;
}): CoverageScheduleRow[] {
  const meta = params.meta;
  const cadenceMonths = cadenceToMonths(meta?.cadence ?? undefined);
  const periodCount = coverageSchedulePeriodCount(meta?.cadence ?? undefined);
  const contract = meta?.contractDate?.trim();
  if (!contract || periodCount === 0) {
    return [];
  }

  const contractDate = parseYmd(contract);
  if (!contractDate) {
    return [];
  }

  const today = startOfToday(params.today ?? new Date());
  const yearStart = policyYearStart(contractDate, today);
  const stepMonths = cadenceMonths === 1 ? 1 : 3;
  const paymentExpenses = params.expenses.filter(params.expensePredicate);
  const lastPaymentDate = meta?.lastPaymentDate?.trim();

  const rows: CoverageScheduleRow[] = [];
  for (let i = 0; i < periodCount; i += 1) {
    const due = addMonths(yearStart, i * stepMonths);
    const dueDate = formatYmd(due);
    const matched = fleetPaymentExpenseForCycle(
      dueDate,
      lastPaymentDate,
      paymentExpenses,
      i + 1,
    );
    const paid = fleetCycleIsPaid(matched);
    const hasExpense = matched != null;

    let status: CoverageScheduleRowStatus;
    if (paid) {
      status = 'paid';
    } else if (due.getTime() < today.getTime()) {
      status = 'overdue';
    } else {
      status = 'future';
    }

    rows.push({
      index: i + 1,
      dueDate,
      status,
      paid,
      hasExpense,
    });
  }

  return rows;
}

/** Próximos vencimientos para cadencias anual/semanal (sin grilla anual). */
export function listSimpleCoverageDueDatesInRange(
  meta: FleetCoveragePaymentMeta | undefined,
  fromYmd: string,
  toYmd: string,
  maxSteps = 24,
): string[] {
  const anchor = meta?.lastPaymentDate?.trim() || meta?.contractDate?.trim();
  if (!anchor) {
    return [];
  }

  const dates: string[] = [];
  let cursor = anchor;
  let guard = 0;

  while (cursor < fromYmd && guard < maxSteps) {
    const next = addCadenceStep(cursor, meta?.cadence ?? undefined);
    if (!next || next <= cursor) {
      break;
    }
    cursor = next;
    guard += 1;
  }

  while (cursor <= toYmd && guard < maxSteps * 2) {
    if (cursor >= fromYmd) {
      dates.push(cursor);
    }
    const next = addCadenceStep(cursor, meta?.cadence ?? undefined);
    if (!next || next <= cursor) {
      break;
    }
    cursor = next;
    guard += 1;
  }

  return dates;
}

export function listInsuranceCoverageDueDatesInRange(
  meta: FleetCoveragePaymentMeta | undefined,
  expenses: readonly Expense[],
  fromYmd: string,
  toYmd: string,
  today: Date = new Date(),
): string[] {
  const schedule = buildCoveragePaymentSchedule({
    meta,
    expenses,
    expensePredicate: isInsurancePaymentExpense,
    today,
  });
  if (schedule.length > 0) {
    return schedule
      .filter((row) => !row.hasExpense && row.dueDate >= fromYmd && row.dueDate <= toYmd)
      .map((row) => row.dueDate);
  }

  const anchor = meta?.lastPaymentDate?.trim() || meta?.contractDate?.trim();
  if (!anchor) {
    return [];
  }
  const paymentExpenses = expenses.filter(isInsurancePaymentExpense);
  return listSimpleCoverageDueDatesInRange(meta, fromYmd, toYmd).filter((dueDate) => {
    const matched = fleetPaymentExpenseForCycle(
      dueDate,
      meta?.lastPaymentDate?.trim(),
      paymentExpenses,
    );
    return matched == null;
  });
}

export function listGpsCoverageDueDatesInRange(
  meta: FleetCoveragePaymentMeta | undefined,
  expenses: readonly Expense[],
  fromYmd: string,
  toYmd: string,
  today: Date = new Date(),
): string[] {
  const schedule = buildCoveragePaymentSchedule({
    meta,
    expenses,
    expensePredicate: isGpsPaymentExpense,
    today,
  });
  if (schedule.length > 0) {
    return schedule
      .filter((row) => !row.hasExpense && row.dueDate >= fromYmd && row.dueDate <= toYmd)
      .map((row) => row.dueDate);
  }

  const paymentExpenses = expenses.filter(isGpsPaymentExpense);
  return listSimpleCoverageDueDatesInRange(meta, fromYmd, toYmd).filter((dueDate) => {
    const matched = fleetPaymentExpenseForCycle(
      dueDate,
      meta?.lastPaymentDate?.trim(),
      paymentExpenses,
    );
    return matched == null;
  });
}
