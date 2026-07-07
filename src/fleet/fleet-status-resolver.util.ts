import type { TripLifecycleStatus } from 'src/trips/lifecycle/trip-lifecycle.types';
import type {
  FleetOverviewAssetStatus,
  FleetOverviewOperationalStatus,
  FleetStatus,
  ResolveFleetStatusInput,
} from './fleet-status.types';

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

/** Normaliza strings crudos de DB/API al vocabulario canónico. */
export function normalizeFleetStatus(
  raw: string | null | undefined,
): FleetStatus {
  const s = (raw ?? '').trim().toLowerCase();
  switch (s) {
    case 'in_use':
    case 'on_route':
    case 'in_transit':
      return 'in_use';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    case 'inactive':
      return 'inactive';
    default:
      return 'available';
  }
}

/** Única interpretación de estado operativo final (A7). */
export function resolveFleetStatus(input: ResolveFleetStatusInput): FleetStatus {
  if (!input.isActive) {
    return 'inactive';
  }
  if (input.maintenanceFlag) {
    return 'maintenance';
  }
  if (input.activeTripStatus === 'in_transit') {
    return 'in_use';
  }
  if (input.activeTripStatus === 'scheduled') {
    return 'scheduled';
  }
  return input.status;
}

export function fleetStatusToOverviewOperationalStatus(
  status: FleetStatus,
): FleetOverviewOperationalStatus {
  switch (status) {
    case 'in_use':
      return 'in_transit';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    default:
      return 'available';
  }
}

export function fleetStatusToPersistedAssetStatus(
  status: FleetStatus,
): FleetOverviewAssetStatus {
  switch (status) {
    case 'in_use':
      return 'in_use';
    case 'scheduled':
      return 'scheduled';
    case 'maintenance':
      return 'maintenance';
    default:
      return 'available';
  }
}

export function normalizePersistedAssetStatus(
  raw: string | null | undefined,
): FleetOverviewAssetStatus {
  return fleetStatusToPersistedAssetStatus(normalizeFleetStatus(raw));
}

export function fleetOverviewOperationalSortRank(
  status: FleetOverviewOperationalStatus,
): number {
  switch (status) {
    case 'in_transit':
      return 3;
    case 'scheduled':
      return 2;
    case 'maintenance':
      return 1;
    default:
      return 0;
  }
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

/** Target de mutación DB desde maniobra activa (sync engine). */
export function resolveFleetMutationTarget(
  activeTripStatus: TripLifecycleStatus,
): FleetStatus {
  return resolveFleetStatus({
    status: 'available',
    isActive: true,
    activeTripStatus,
  });
}

export function resolveFleetTargetForResource(
  _kind: FleetResourceKind,
  activeTripStatuses: readonly string[],
): FleetStatus {
  const dominant = pickDominantActiveTripStatus(activeTripStatuses);
  if (!dominant) {
    return 'available';
  }
  return resolveFleetMutationTarget(dominant);
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
