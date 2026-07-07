import { coveragePaymentPeriodLabel, cadenceToMonths } from './fleet-coverage-payment-period.util';

export function gpsServiceConceptLabel(cadence: string | undefined): string {
  const months = cadenceToMonths(cadence);
  if (months === 1) {
    return 'GPS - mensual';
  }
  if (months === 3) {
    return 'GPS - trimestral';
  }
  if (months === 12) {
    return 'GPS - anual';
  }
  const raw = (cadence ?? '').trim().toLowerCase();
  if (raw === 'weekly' || raw === 'semanal') {
    return 'GPS - semanal';
  }
  return 'GPS';
}

function normalizePaymentMethod(raw: string | null | undefined): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

export const GPS_INITIAL_SERVICE_DESC_PREFIX = 'Contratación de GPS';
export const GPS_PAYMENT_EXPENSE_DESC_PREFIX = 'Pago de GPS';

export type GpsProfileLike = {
  hasGps?: boolean | null;
  gpsProviderBrand?: string | null;
  gpsPaymentCadence?: string | null;
  gpsContractDate?: string | null;
  gpsLastPaymentDate?: string | null;
  gpsPrice?: string | number | null;
  gpsPaymentMethod?: string | null;
  gpsInvoiceRequired?: boolean | null;
};

export type GpsPaymentCandidate = {
  date: string;
  cost: number;
  category: string;
  description: string;
  vendor?: string;
  paymentMethod?: string;
  invoiceRequired?: boolean;
};

function normalizeDate(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)?.[1];
  return ymd ?? trimmed;
}

function parsePositiveCost(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function gpsProfileIsConfigured(
  profile: GpsProfileLike | null | undefined,
): boolean {
  if (profile?.hasGps === true) {
    return true;
  }
  if (profile?.hasGps === false) {
    return false;
  }
  return !!(
    profile?.gpsProviderBrand?.trim() ||
    profile?.gpsContractDate?.trim() ||
    parsePositiveCost(profile?.gpsPrice) != null
  );
}

function resolveGpsHasFlag(
  previous: GpsProfileLike | null | undefined,
  incoming: GpsProfileLike,
): boolean {
  if (incoming.hasGps === true || previous?.hasGps === true) {
    return true;
  }
  if (incoming.hasGps === false || previous?.hasGps === false) {
    return false;
  }
  return gpsProfileIsConfigured(previous) || gpsProfileIsConfigured(incoming);
}

export function mergeGpsProfile(
  previous: GpsProfileLike | null | undefined,
  incoming: GpsProfileLike,
): GpsProfileLike {
  if (!resolveGpsHasFlag(previous, incoming)) {
    return { hasGps: false };
  }
  return {
    hasGps: true,
    gpsProviderBrand: incoming.gpsProviderBrand ?? previous?.gpsProviderBrand ?? undefined,
    gpsPaymentCadence:
      incoming.gpsPaymentCadence ?? previous?.gpsPaymentCadence ?? undefined,
    gpsContractDate: incoming.gpsContractDate ?? previous?.gpsContractDate ?? undefined,
    gpsLastPaymentDate:
      incoming.gpsLastPaymentDate ?? previous?.gpsLastPaymentDate ?? undefined,
    gpsPrice: incoming.gpsPrice ?? previous?.gpsPrice ?? undefined,
    gpsPaymentMethod: incoming.gpsPaymentMethod ?? previous?.gpsPaymentMethod ?? undefined,
    gpsInvoiceRequired: incoming.gpsInvoiceRequired ?? previous?.gpsInvoiceRequired ?? undefined,
  };
}

function buildGpsDescription(
  provider: string,
  cadence: string,
  prefix: string,
  contractDate: string | undefined,
  paymentDate: string,
): string {
  const parts = [prefix];
  if (provider) {
    parts.push(`· ${provider}`);
  }
  const periodLabel = coveragePaymentPeriodLabel(cadence, contractDate, paymentDate);
  if (periodLabel) {
    parts.push(`(${periodLabel})`);
  } else if (cadence) {
    parts.push(`(${cadence})`);
  }
  return parts.join(' ');
}

/** Descripción de pago recurrente (misma convención que el ledger). */
export function buildGpsPaymentExpenseDescription(
  profile: GpsProfileLike,
  paymentDate: string,
): string {
  return buildGpsDescription(
    (profile.gpsProviderBrand ?? '').trim(),
    (profile.gpsPaymentCadence ?? '').trim(),
    GPS_PAYMENT_EXPENSE_DESC_PREFIX,
    normalizeDate(profile.gpsContractDate) || undefined,
    paymentDate,
  );
}

function buildGpsPaymentCandidate(
  merged: GpsProfileLike,
  date: string,
  cost: number,
  descriptionPrefix: string,
): GpsPaymentCandidate {
  const provider = (merged.gpsProviderBrand ?? '').trim();
  const cadence = (merged.gpsPaymentCadence ?? '').trim();
  const contractDate = normalizeDate(merged.gpsContractDate);
  return {
    date,
    cost,
    category: gpsServiceConceptLabel(cadence),
    description: buildGpsDescription(
      provider,
      cadence,
      descriptionPrefix,
      contractDate || undefined,
      date,
    ),
    vendor: provider || undefined,
    paymentMethod: normalizePaymentMethod(merged.gpsPaymentMethod),
    invoiceRequired: merged.gpsInvoiceRequired === true,
  };
}

export function buildInitialGpsService(
  merged: GpsProfileLike,
): GpsPaymentCandidate | null {
  if (merged.hasGps !== true) {
    return null;
  }
  const contractDate = normalizeDate(merged.gpsContractDate);
  if (!contractDate) {
    return null;
  }
  const cost = parsePositiveCost(merged.gpsPrice);
  if (cost == null) {
    return null;
  }
  const provider = (merged.gpsProviderBrand ?? '').trim();
  if (!provider) {
    return null;
  }
  return buildGpsPaymentCandidate(
    merged,
    contractDate,
    cost,
    GPS_INITIAL_SERVICE_DESC_PREFIX,
  );
}

function gpsLastPaymentDateProvided(incoming: GpsProfileLike): boolean {
  return (
    'gpsLastPaymentDate' in incoming && incoming.gpsLastPaymentDate !== undefined
  );
}

export function findNewGpsPayments(
  previous: GpsProfileLike | null | undefined,
  incoming: GpsProfileLike,
): GpsPaymentCandidate[] {
  if (!gpsLastPaymentDateProvided(incoming)) {
    return [];
  }
  const merged = mergeGpsProfile(previous, incoming);
  if (merged.hasGps !== true) {
    return [];
  }
  const date = normalizeDate(incoming.gpsLastPaymentDate);
  if (!date) {
    return [];
  }
  const previousDate = normalizeDate(previous?.gpsLastPaymentDate);
  if (previousDate === date) {
    return [];
  }

  const cost = parsePositiveCost(merged.gpsPrice);
  if (cost == null) {
    return [];
  }

  return [
    buildGpsPaymentCandidate(merged, date, cost, GPS_PAYMENT_EXPENSE_DESC_PREFIX),
  ];
}
