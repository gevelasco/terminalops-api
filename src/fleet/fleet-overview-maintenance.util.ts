import type { FleetOverviewRenewalStatus } from './dto/fleet-overview.dto';

export type FleetMetaLike = {
  lastMaintenanceDate?: string | null;
  maintenanceNextDateOverride?: string | null;
  maintenanceAlertByKm?: boolean | null;
  maintenanceKmRemaining?: number | null;
  maintenanceKmInterval?: number | null;
  maintenanceTripKmAtLastService?: number | null;
  tireCondition?: string | null;
  verificationPhysMechDate?: string | null;
  verificationEmissionsDate?: string | null;
  verificationDoubleArticulatedApplies?: boolean | null;
  verificationDoubleArticulatedDate?: string | null;
  insuranceContractDate?: string | null;
  insurancePaymentCadence?: string | null;
};

const MAINT_CYCLE_MO = 6;

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

function maintenanceBucket(meta: FleetMetaLike | undefined): FleetOverviewRenewalStatus {
  if (!meta) {
    return 'na';
  }
  if (meta.maintenanceAlertByKm === true) {
    const rem = meta.maintenanceKmRemaining;
    if (rem == null || !Number.isFinite(rem)) {
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
  const override = meta.maintenanceNextDateOverride?.trim();
  if (override) {
    return renewalBucketFromTargetYmd(override);
  }
  return renewalBucketFromLast(meta.lastMaintenanceDate, MAINT_CYCLE_MO);
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

function insuranceBucket(meta: FleetMetaLike | undefined): FleetOverviewRenewalStatus {
  const contract = meta?.insuranceContractDate?.trim();
  if (!contract) {
    return 'na';
  }
  const cadence = (meta?.insurancePaymentCadence ?? '').trim().toLowerCase();
  const months = cadence.includes('anual') || cadence.includes('year') ? 12 : 6;
  return renewalBucketFromLast(contract, months);
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

export function nextMaintenanceDateLabel(meta: FleetMetaLike | undefined): string | null {
  if (!meta) {
    return null;
  }
  const override = meta.maintenanceNextDateOverride?.trim();
  if (override) {
    return fmtMxDateYmd(override);
  }
  const last = meta.lastMaintenanceDate?.trim();
  if (!last) {
    return null;
  }
  const target = addMonthsYmd(last, MAINT_CYCLE_MO);
  return target ? fmtMxDateYmd(target) : null;
}

export function buildMaintenanceSummary(
  meta: FleetMetaLike | undefined,
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
  const maintenanceRenewal = maintenanceBucket(meta);
  const insuranceRenewal = insuranceBucket(meta);
  const inspectionRenewal = verificationBucket(meta);

  const kmRemaining = meta?.maintenanceKmRemaining;
  const kmSince =
    typeof kmRemaining === 'number' && Number.isFinite(kmRemaining)
      ? Math.max(0, (meta?.maintenanceKmInterval ?? 0) - kmRemaining)
      : undefined;

  return {
    lastMaintenanceDate: fmtMxDateYmd(meta?.lastMaintenanceDate) ?? undefined,
    nextMaintenanceDate: nextMaintenanceDateLabel(meta) ?? undefined,
    kmSinceLastMaintenance: kmSince,
    tireStatus: meta?.tireCondition?.trim() || undefined,
    insuranceStatus: renewalStatusLabel(insuranceRenewal),
    inspectionStatus: renewalStatusLabel(inspectionRenewal),
    maintenanceRenewal,
    insuranceRenewal,
    inspectionRenewal,
  };
}
