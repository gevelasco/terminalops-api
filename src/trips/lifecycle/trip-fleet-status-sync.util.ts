import type { TripLifecycleStatus } from './trip-lifecycle.types';

export const TRIP_FLEET_ACTIVE_STATUSES: readonly TripLifecycleStatus[] = [
  'scheduled',
  'in_transit',
];

export const OPERATOR_PROTECTED_STATUSES = new Set([
  'maintenance',
  'leave',
  'inactive',
  'incapacitated',
]);

export const UNIT_PROTECTED_STATUSES = new Set(['maintenance']);

export const EQUIPMENT_PROTECTED_STATUSES = new Set(['maintenance']);

export type FleetResourceKind = 'unit' | 'operator' | 'equipment';

export interface FleetOperationalTargets {
  unit: string;
  operator: string;
  equipment: string;
}

/** Prioridad operativa entre maniobras activas del mismo recurso. */
export function pickDominantActiveTripStatus(
  statuses: readonly string[],
): TripLifecycleStatus | null {
  if (statuses.includes('in_transit')) {
    return 'in_transit';
  }
  if (statuses.includes('scheduled')) {
    return 'scheduled';
  }
  return null;
}

export function fleetTargetsForActiveTripStatus(
  status: TripLifecycleStatus,
): FleetOperationalTargets {
  if (status === 'in_transit') {
    return {
      unit: 'in_use',
      operator: 'on_route',
      equipment: 'in_use',
    };
  }
  return {
    unit: 'scheduled',
    operator: 'scheduled',
    equipment: 'scheduled',
  };
}

export function fleetTargetsWhenNoActiveTrips(): FleetOperationalTargets {
  return {
    unit: 'available',
    operator: 'available',
    equipment: 'available',
  };
}

export function resolveFleetTargetForResource(
  kind: FleetResourceKind,
  activeTripStatuses: readonly string[],
): string {
  const dominant = pickDominantActiveTripStatus(activeTripStatuses);
  if (!dominant) {
    return fleetTargetsWhenNoActiveTrips()[kind];
  }
  return fleetTargetsForActiveTripStatus(dominant)[kind];
}

export function isProtectedFleetStatus(
  kind: FleetResourceKind,
  currentStatus: string | undefined | null,
): boolean {
  const normalized = (currentStatus ?? '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  switch (kind) {
    case 'unit':
      return UNIT_PROTECTED_STATUSES.has(normalized);
    case 'operator':
      return OPERATOR_PROTECTED_STATUSES.has(normalized);
    case 'equipment':
      return EQUIPMENT_PROTECTED_STATUSES.has(normalized);
    default:
      return false;
  }
}
