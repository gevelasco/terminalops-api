function parseYmd(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function policyYearStart(contractDate: Date, referenceDate: Date): Date {
  const elapsed = monthsBetween(contractDate, referenceDate);
  const yearIndex = Math.max(0, Math.floor(elapsed / 12));
  return addMonths(contractDate, yearIndex * 12);
}

export function cadenceToMonths(cad: string | undefined): number {
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

export function coverageSchedulePeriodCount(cadence: string | undefined): number {
  const months = cadenceToMonths(cadence);
  if (months === 1) {
    return 12;
  }
  if (months === 3) {
    return 4;
  }
  return 0;
}

/** Etiqueta de periodo para descripción de gasto (p. ej. `Mensualidad 2/12`). */
export function coveragePaymentPeriodLabel(
  cadence: string | undefined,
  contractDateRaw: string | undefined,
  paymentDateRaw: string,
): string | null {
  const cadenceMonths = cadenceToMonths(cadence);
  const total = coverageSchedulePeriodCount(cadence);
  if (cadenceMonths !== 1 || total === 0) {
    return null;
  }

  const contractDate = parseYmd(contractDateRaw ?? '');
  const paymentDate = parseYmd(paymentDateRaw);
  if (!contractDate || !paymentDate) {
    return null;
  }

  const yearStart = policyYearStart(contractDate, paymentDate);
  const offsetMonths = monthsBetween(yearStart, paymentDate);
  if (offsetMonths < 0) {
    return null;
  }

  const index = Math.min(Math.max(Math.floor(offsetMonths / cadenceMonths) + 1, 1), total);
  return `Mensualidad ${index}/${total}`;
}

/** @deprecated No usar backfill automático de ciclos; solo confirmación explícita del usuario. */
export function listCoverageCycleDueDatesThroughLastPayment(
  cadence: string | undefined,
  contractDateRaw: string | undefined,
  lastDueDateRaw: string | undefined,
): string[] {
  const maxDue = coverageMaxCycleDueOnOrBefore(cadence, contractDateRaw, lastDueDateRaw);
  if (!maxDue) {
    return [];
  }
  return listCoverageCycleDueDatesThroughExactLastDue(
    cadence,
    contractDateRaw,
    maxDue,
  );
}

function listCoverageCycleDueDatesThroughExactLastDue(
  cadence: string | undefined,
  contractDateRaw: string | undefined,
  lastCycleDueRaw: string | undefined,
): string[] {
  const cadenceMonths = cadenceToMonths(cadence);
  const periodCount = coverageSchedulePeriodCount(cadence);
  const contractDate = parseYmd(contractDateRaw ?? '');
  const lastDue = parseYmd(lastCycleDueRaw ?? '');
  if (!contractDate || !lastDue || periodCount === 0) {
    return [];
  }

  const stepMonths = cadenceMonths === 1 ? 1 : cadenceMonths === 3 ? 3 : 0;
  if (stepMonths === 0) {
    return [];
  }

  const yearStart = policyYearStart(contractDate, lastDue);
  const lastDueStr = formatYmd(lastDue);
  const dates: string[] = [];
  for (let i = 0; i < periodCount; i += 1) {
    const dueStr = formatYmd(addMonths(yearStart, i * stepMonths));
    dates.push(dueStr);
    if (dueStr >= lastDueStr) {
      break;
    }
  }
  return dates;
}

/** Fecha de vencimiento del ciclo N dentro del año de póliza vigente. */
export function coverageCycleDueDateForInstallment(
  cadence: string | undefined,
  contractDateRaw: string | undefined,
  installmentIndex: number,
  referenceDueDateRaw?: string | undefined,
): string | null {
  if (installmentIndex < 1) {
    return null;
  }
  const contractDate = parseYmd(contractDateRaw ?? '');
  if (!contractDate) {
    return null;
  }
  const cadenceMonths = cadenceToMonths(cadence);
  const stepMonths = cadenceMonths === 1 ? 1 : cadenceMonths === 3 ? 3 : 0;
  const periodCount = coverageSchedulePeriodCount(cadence);
  if (stepMonths === 0 || installmentIndex > periodCount) {
    return null;
  }
  const ref =
    parseYmd(referenceDueDateRaw ?? contractDateRaw ?? '') ?? contractDate;
  const yearStart = policyYearStart(contractDate, ref);
  return formatYmd(addMonths(yearStart, (installmentIndex - 1) * stepMonths));
}

/** Mayor vencimiento de ciclo con due ≤ referencia (p. ej. fecha real de pago). */
export function coverageMaxCycleDueOnOrBefore(
  cadence: string | undefined,
  contractDateRaw: string | undefined,
  referenceDateRaw: string | undefined,
): string | null {
  const contractDate = parseYmd(contractDateRaw ?? '');
  const reference = parseYmd(referenceDateRaw ?? '');
  const periodCount = coverageSchedulePeriodCount(cadence);
  const cadenceMonths = cadenceToMonths(cadence);
  const stepMonths = cadenceMonths === 1 ? 1 : cadenceMonths === 3 ? 3 : 0;
  if (!contractDate || !reference || periodCount === 0 || stepMonths === 0) {
    return null;
  }
  const yearStart = policyYearStart(contractDate, reference);
  const refStr = formatYmd(reference);
  let matched: string | null = null;
  for (let i = 0; i < periodCount; i += 1) {
    const dueStr = formatYmd(addMonths(yearStart, i * stepMonths));
    if (dueStr <= refStr) {
      matched = dueStr;
    } else {
      break;
    }
  }
  return matched;
}

export function parseCoverageInstallmentIndex(
  description: string | null | undefined,
): number | null {
  const match = /\(Mensualidad (\d+)\/\d+\)/.exec(description ?? '');
  if (!match) {
    return null;
  }
  const index = Number(match[1]);
  return Number.isFinite(index) && index > 0 ? index : null;
}
