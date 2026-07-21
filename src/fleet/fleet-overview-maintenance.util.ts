import type { FleetOverviewRenewalStatus } from './dto/fleet-overview.dto';
import {
  type CompanyMaintenancePolicyContext,
  maintenanceKmRemainingFromCounter,
} from 'src/units/company-maintenance-policy.util';

export type FleetMetaLike = {
  lastMaintenanceDate?: string | null;
  maintenanceKmCounter?: number | null;
  tireCondition?: string | null;
  verificationPhysMechDate?: string | null;
  verificationEmissionsDate?: string | null;
  verificationDoubleArticulatedApplies?: boolean | null;
  verificationDoubleArticulatedDate?: string | null;
  insuranceContractDate?: string | null;
  insuranceLastPaymentDate?: string | null;
  insurancePaymentCadence?: string | null;
};

function parseYmd(value: string): Date | null {
  const t = value.trim();
  if (!t) {
    return null;
  }
  const d = new Date(`${t}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonthsYmd(ymd: string, months: number): string | null {
  const d = parseYmd(ymd);
  if (!d) {
    return null;
  }
  const next = new Date(d);
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

function daysUntilYmd(ymd: string): number | null {
  const d = parseYmd(ymd);
  if (!d) {
    return null;
  }
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function renewalBucketFromTargetYmd(
  targetYmd: string,
): FleetOverviewRenewalStatus {
  const days = daysUntilYmd(targetYmd);
  if (days == null) {
    return 'na';
  }
  if (days < 0) {
    return 'due';
  }
  if (days <= 30) {
    return 'soon';
  }
  return 'ok';
}

function renewalBucketFromLast(
  lastYmd: string | null | undefined,
  cycleMonths: number,
): FleetOverviewRenewalStatus {
  const last = lastYmd?.trim();
  if (!last) {
    return 'na';
  }
  const target = addMonthsYmd(last, cycleMonths);
  if (!target) {
    return 'na';
  }
  return renewalBucketFromTargetYmd(target);
}

function maintenanceBucket(
  meta: FleetMetaLike | undefined,
  policy?: CompanyMaintenancePolicyContext,
): FleetOverviewRenewalStatus {
  if (!meta) {
    return 'na';
  }
  if (policy?.kmControlEnabled) {
    const rem = maintenanceKmRemainingFromCounter(
      meta.maintenanceKmCounter ?? 0,
      policy.kmIntervalDefault,
    );
    if (rem == null) {
      return 'na';
    }
    if (rem <= 0) {
      return 'due';
    }
    if (rem <= 300) {
      return 'soon';
    }
    return 'ok';
  }
  if (policy?.dateControlEnabled) {
    return renewalBucketFromLast(
      meta.lastMaintenanceDate,
      policy.datePeriodMonths,
    );
  }
  return renewalBucketFromLast(meta.lastMaintenanceDate, 6);
}

function verificationBucket(meta: FleetMetaLike | undefined): FleetOverviewRenewalStatus {
  if (!meta) {
    return 'na';
  }
  const phys = renewalBucketFromLast(meta.verificationPhysMechDate, 6);
  const emis = renewalBucketFromLast(meta.verificationEmissionsDate, 6);
  const rank = (b: FleetOverviewRenewalStatus) =>
    b === 'due' ? 3 : b === 'soon' ? 2 : b === 'ok' ? 1 : 0;
  let worst: FleetOverviewRenewalStatus = 'na';
  let r = -1;
  for (const b of [phys, emis]) {
    const x = rank(b);
    if (x > r) {
      r = x;
      worst = b;
    }
  }
  if (meta.verificationDoubleArticulatedApplies === true) {
    const doubleDate = meta.verificationDoubleArticulatedDate?.trim();
    const double = !doubleDate ? 'due' : renewalBucketFromTargetYmd(doubleDate);
    if (rank(double) > r) {
      worst = double;
    }
  }
  return worst;
}

function insuranceCadenceMonths(cadence: string | undefined): number {
  const raw = (cadence ?? '').trim().toLowerCase();
  if (raw.includes('semanal') || raw.includes('weekly')) {
    return 0;
  }
  if (raw.includes('mensual') || raw.includes('monthly')) {
    return 1;
  }
  if (raw.includes('trimestral') || raw.includes('quarterly')) {
    return 3;
  }
  if (raw.includes('anual') || raw.includes('annual')) {
    return 12;
  }
  return 12;
}

function insuranceBucket(meta: FleetMetaLike | undefined): FleetOverviewRenewalStatus {
  const anchor =
    meta?.insuranceLastPaymentDate?.trim() || meta?.insuranceContractDate?.trim();
  if (!anchor) {
    return 'na';
  }
  const months = insuranceCadenceMonths(meta?.insurancePaymentCadence ?? undefined);
  if (months === 0) {
    const start = parseYmd(anchor);
    if (!start) {
      return 'na';
    }
    const next = new Date(start.getTime() + 7 * 86400000);
    const days = Math.round((next.getTime() - Date.now()) / 86400000);
    if (days < 0) {
      return 'due';
    }
    if (days <= 30) {
      return 'soon';
    }
    return 'ok';
  }
  return renewalBucketFromLast(anchor, months);
}

export function renewalStatusLabel(bucket: FleetOverviewRenewalStatus): string {
  switch (bucket) {
    case 'due':
      return 'Vencido';
    case 'soon':
      return 'Próximo';
    case 'ok':
      return 'Al día';
    default:
      return '—';
  }
}

export function fmtMxDateYmd(ymd: string | null | undefined): string | null {
  const d = ymd?.trim() ? parseYmd(ymd) : null;
  if (!d) {
    return null;
  }
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function nextMaintenanceDateLabel(
  meta: FleetMetaLike | undefined,
  policy?: CompanyMaintenancePolicyContext,
): string | null {
  if (!meta) {
    return null;
  }
  const last = meta.lastMaintenanceDate?.trim();
  if (!last) {
    return null;
  }
  const months = policy?.dateControlEnabled
    ? policy.datePeriodMonths
    : 6;
  const target = addMonthsYmd(last, months);
  return target ? fmtMxDateYmd(target) : null;
}

export function buildMaintenanceSummary(
  meta: FleetMetaLike | undefined,
  policy?: CompanyMaintenancePolicyContext,
): {
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  kmSinceLastMaintenance?: number;
  tireStatus?: string;
  insuranceStatus?: string;
  inspectionStatus?: string;
  maintenanceRenewal: FleetOverviewRenewalStatus;
  insuranceRenewal: FleetOverviewRenewalStatus;
  inspectionRenewal: FleetOverviewRenewalStatus;
} {
  const maintenanceRenewal = maintenanceBucket(meta, policy);
  const insuranceRenewal = insuranceBucket(meta);
  const inspectionRenewal = verificationBucket(meta);

  const counter = meta?.maintenanceKmCounter;
  const kmSince =
    policy?.kmControlEnabled &&
    typeof counter === 'number' &&
    Number.isFinite(counter)
      ? Math.max(0, counter)
      : undefined;

  return {
    lastMaintenanceDate: fmtMxDateYmd(meta?.lastMaintenanceDate) ?? undefined,
    nextMaintenanceDate: nextMaintenanceDateLabel(meta, policy) ?? undefined,
    kmSinceLastMaintenance: kmSince,
    tireStatus: meta?.tireCondition?.trim() || undefined,
    insuranceStatus: renewalStatusLabel(insuranceRenewal),
    inspectionStatus: renewalStatusLabel(inspectionRenewal),
    maintenanceRenewal,
    insuranceRenewal,
    inspectionRenewal,
  };
}

export type { CompanyMaintenancePolicyContext };
