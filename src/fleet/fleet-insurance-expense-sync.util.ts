import {
  coveragePaymentPeriodLabel,
  cadenceToMonths,
} from './fleet-coverage-payment-period.util';

export function insurancePolicyConceptLabel(cadence: string | undefined): string {
  const months = cadenceToMonths(cadence);
  if (months === 1) {
    return 'Póliza - mensual';
  }
  if (months === 3) {
    return 'Póliza - trimestral';
  }
  if (months === 12) {
    return 'Póliza - anual';
  }
  const raw = (cadence ?? '').trim().toLowerCase();
  if (raw === 'weekly' || raw === 'semanal') {
    return 'Póliza - semanal';
  }
  return 'Póliza';
}

function normalizePaymentMethod(raw: string | null | undefined): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

export const INSURANCE_INITIAL_PREMIUM_DESC_PREFIX = 'Contratación de póliza';
export const INSURANCE_PAYMENT_EXPENSE_DESC_PREFIX = 'Pago de póliza';

export type InsuranceProfileLike = {
  insuranceCarrierName?: string | null;
  insurancePolicyNumber?: string | null;
  insurancePaymentCadence?: string | null;
  insuranceContractDate?: string | null;
  insuranceLastPaymentDate?: string | null;
  insuranceCost?: string | number | null;
  insurancePaymentMethod?: string | null;
  insuranceInvoiceRequired?: boolean | null;
};

export type InsurancePaymentCandidate = {
  date: string;
  cost: number;
  category: string;
  description: string;
  vendor?: string;
  paymentMethod?: string;
  invoiceRequired?: boolean;
};

export function mergeInsuranceProfile(
  previous: InsuranceProfileLike | null | undefined,
  incoming: InsuranceProfileLike,
): InsuranceProfileLike {
  return {
    insuranceCarrierName:
      incoming.insuranceCarrierName ?? previous?.insuranceCarrierName ?? undefined,
    insurancePolicyNumber:
      incoming.insurancePolicyNumber ?? previous?.insurancePolicyNumber ?? undefined,
    insurancePaymentCadence:
      incoming.insurancePaymentCadence ?? previous?.insurancePaymentCadence ?? undefined,
    insuranceContractDate:
      incoming.insuranceContractDate ?? previous?.insuranceContractDate ?? undefined,
    insuranceLastPaymentDate:
      incoming.insuranceLastPaymentDate ?? previous?.insuranceLastPaymentDate ?? undefined,
    insuranceCost: incoming.insuranceCost ?? previous?.insuranceCost ?? undefined,
    insurancePaymentMethod:
      incoming.insurancePaymentMethod ?? previous?.insurancePaymentMethod ?? undefined,
    insuranceInvoiceRequired:
      incoming.insuranceInvoiceRequired ?? previous?.insuranceInvoiceRequired ?? undefined,
  };
}

function normalizeDate(raw: string | null | undefined): string {
  return raw?.trim() ?? '';
}

function parsePositiveCost(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const amount = Number(raw);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function buildInsuranceDescription(
  policyNumber: string,
  cadence: string,
  prefix: string,
  contractDate: string | undefined,
  paymentDate: string,
): string {
  const parts = [prefix];
  if (policyNumber) {
    parts.push(`· ${policyNumber}`);
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
export function buildInsurancePaymentExpenseDescription(
  profile: InsuranceProfileLike,
  paymentDate: string,
): string {
  return buildInsuranceDescription(
    (profile.insurancePolicyNumber ?? '').trim(),
    (profile.insurancePaymentCadence ?? '').trim(),
    INSURANCE_PAYMENT_EXPENSE_DESC_PREFIX,
    normalizeDate(profile.insuranceContractDate) || undefined,
    paymentDate,
  );
}

function buildInsurancePaymentCandidate(
  merged: InsuranceProfileLike,
  date: string,
  cost: number,
  descriptionPrefix: string,
): InsurancePaymentCandidate {
  const carrier = (merged.insuranceCarrierName ?? '').trim();
  const policy = (merged.insurancePolicyNumber ?? '').trim();
  const cadence = (merged.insurancePaymentCadence ?? '').trim();
  const contractDate = normalizeDate(merged.insuranceContractDate);
  return {
    date,
    cost,
    category: insurancePolicyConceptLabel(cadence),
    description: buildInsuranceDescription(
      policy,
      cadence,
      descriptionPrefix,
      contractDate || undefined,
      date,
    ),
    vendor: carrier || undefined,
    paymentMethod: normalizePaymentMethod(merged.insurancePaymentMethod),
    invoiceRequired: merged.insuranceInvoiceRequired === true,
  };
}

/** Primer cobro al contratar (fecha de contratación + costo por ciclo). */
export function buildInitialInsurancePremium(
  merged: InsuranceProfileLike,
): InsurancePaymentCandidate | null {
  const contractDate = normalizeDate(merged.insuranceContractDate);
  if (!contractDate) {
    return null;
  }
  const cost = parsePositiveCost(merged.insuranceCost);
  if (cost == null) {
    return null;
  }
  const policy = (merged.insurancePolicyNumber ?? '').trim();
  const carrier = (merged.insuranceCarrierName ?? '').trim();
  if (!policy && !carrier) {
    return null;
  }
  return buildInsurancePaymentCandidate(
    merged,
    contractDate,
    cost,
    INSURANCE_INITIAL_PREMIUM_DESC_PREFIX,
  );
}

function insuranceLastPaymentDateProvided(incoming: InsuranceProfileLike): boolean {
  return (
    'insuranceLastPaymentDate' in incoming &&
    incoming.insuranceLastPaymentDate !== undefined
  );
}

export function findNewInsurancePayments(
  previous: InsuranceProfileLike | null | undefined,
  incoming: InsuranceProfileLike,
): InsurancePaymentCandidate[] {
  if (!insuranceLastPaymentDateProvided(incoming)) {
    return [];
  }
  const date = normalizeDate(incoming.insuranceLastPaymentDate);
  if (!date) {
    return [];
  }
  const previousDate = normalizeDate(previous?.insuranceLastPaymentDate);
  if (previousDate === date) {
    return [];
  }

  const merged = mergeInsuranceProfile(previous, incoming);
  const cost = parsePositiveCost(merged.insuranceCost);
  if (cost == null) {
    return [];
  }

  return [
    buildInsurancePaymentCandidate(
      merged,
      date,
      cost,
      INSURANCE_PAYMENT_EXPENSE_DESC_PREFIX,
    ),
  ];
}
