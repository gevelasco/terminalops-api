import type { TripLifecycleStatus } from './trip-lifecycle.types';
import {
  EQUIPMENT_PROTECTED_STATUSES,
  isProtectedFleetStatus,
  OPERATOR_PROTECTED_STATUSES,
  pickDominantActiveTripStatus,
  resolveFleetMutationTarget,
  resolveFleetTargetForResource as resolveFleetTargetStatus,
  TRIP_FLEET_ACTIVE_STATUSES,
  UNIT_PROTECTED_STATUSES,
  type FleetResourceKind,
} from 'src/fleet/fleet-status-resolver.util';

export {
  TRIP_FLEET_ACTIVE_STATUSES,
  OPERATOR_PROTECTED_STATUSES,
  UNIT_PROTECTED_STATUSES,
  EQUIPMENT_PROTECTED_STATUSES,
  pickDominantActiveTripStatus,
  isProtectedFleetStatus,
  type FleetResourceKind,
};

export interface FleetOperationalTargets {
  unit: string;
  operator: string;
  equipment: string;
}

function targetsFromStatus(status: string): FleetOperationalTargets {
  return { unit: status, operator: status, equipment: status };
}

/** Mutación DB: maniobra activa → status persistido por recurso. */
export function fleetTargetsForActiveTripStatus(
  status: TripLifecycleStatus,
): FleetOperationalTargets {
  return targetsFromStatus(resolveFleetMutationTarget(status));
}

export function fleetTargetsWhenNoActiveTrips(): FleetOperationalTargets {
  return targetsFromStatus('available');
}

/** Mutación DB: prioridad de maniobras activas → status persistido. */
export function resolveFleetTargetForResource(
  kind: FleetResourceKind,
  activeTripStatuses: readonly string[],
): string {
  return resolveFleetTargetStatus(kind, activeTripStatuses);
}
