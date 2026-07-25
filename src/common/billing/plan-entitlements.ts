import { ForbiddenException } from '@nestjs/common';

export type SubscriptionPlanId = 'basic' | 'standard' | 'pro';

export interface PlanEntitlements {
  maxUnits: number;
  maxEquipment: number;
  maxOperators: number;
  maxTripsPerMonth: number | null;
  maxAdmins: number;
  maxStaffUsers: number;
  dieselAutomatic: boolean;
  maintenancePolicy: boolean;
  advancedTenure: boolean;
}

/** Mirror de `subscription-plans.ts` (app). Fuente de verdad server-side. */
const PLAN_ENTITLEMENTS: Record<SubscriptionPlanId, PlanEntitlements> = {
  basic: {
    maxUnits: 3,
    maxEquipment: 6,
    maxOperators: 5,
    maxTripsPerMonth: 30,
    maxAdmins: 1,
    maxStaffUsers: 1,
    dieselAutomatic: false,
    maintenancePolicy: false,
    advancedTenure: false,
  },
  standard: {
    maxUnits: 15,
    maxEquipment: 30,
    maxOperators: 20,
    maxTripsPerMonth: 200,
    maxAdmins: 2,
    maxStaffUsers: 5,
    dieselAutomatic: true,
    maintenancePolicy: true,
    advancedTenure: true,
  },
  pro: {
    maxUnits: 50,
    maxEquipment: 100,
    maxOperators: 80,
    maxTripsPerMonth: null,
    maxAdmins: 5,
    maxStaffUsers: 20,
    dieselAutomatic: true,
    maintenancePolicy: true,
    advancedTenure: true,
  },
};

const LEGACY_PLAN_ALIASES: Record<string, SubscriptionPlanId> = {
  trial: 'basic',
  starter: 'basic',
  free: 'basic',
  professional: 'standard',
  business: 'standard',
  enterprise: 'pro',
  'pro+': 'pro',
  pro_plus: 'pro',
};

export function normalizeSubscriptionPlanId(
  raw: string | null | undefined,
): SubscriptionPlanId {
  const key = raw?.trim().toLowerCase() ?? '';
  if (key === 'basic' || key === 'standard' || key === 'pro') {
    return key;
  }
  return LEGACY_PLAN_ALIASES[key] ?? 'basic';
}

export function getPlanEntitlements(
  planRaw: string | null | undefined,
): PlanEntitlements {
  return PLAN_ENTITLEMENTS[normalizeSubscriptionPlanId(planRaw)];
}

export function assertDieselAutomaticAllowed(
  planRaw: string | null | undefined,
): void {
  if (!getPlanEntitlements(planRaw).dieselAutomatic) {
    throw new ForbiddenException(
      'El control automático de diésel no está incluido en tu plan. Actualiza a Standard o Pro.',
    );
  }
}

export function assertMaintenancePolicyAllowed(
  planRaw: string | null | undefined,
): void {
  if (!getPlanEntitlements(planRaw).maintenancePolicy) {
    throw new ForbiddenException(
      'La política de mantenimiento no está incluida en tu plan. Actualiza a Standard o Pro.',
    );
  }
}

export function assertAdvancedTenureAllowed(
  planRaw: string | null | undefined,
  tenureMode: string | null | undefined,
): void {
  const mode = tenureMode?.trim().toLowerCase();
  if (!mode || mode === 'owned') {
    return;
  }
  if (!getPlanEntitlements(planRaw).advancedTenure) {
    throw new ForbiddenException(
      'La tenencia avanzada (financiado / arrendado / administrado) no está incluida en tu plan.',
    );
  }
}

export function assertWithinQuota(
  label: string,
  currentCount: number,
  max: number | null,
): void {
  if (max == null) {
    return;
  }
  if (currentCount >= max) {
    throw new ForbiddenException(
      `Has alcanzado el límite de ${label} de tu plan (${max}).`,
    );
  }
}
