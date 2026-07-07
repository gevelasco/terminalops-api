import type { TripLifecycleStatus } from 'src/trips/lifecycle/trip-lifecycle.types';
import type {
  FleetOverviewAssetStatus,
  FleetOverviewOperationalStatus,
} from './dto/fleet-overview.dto';

/** Estado operativo canónico de recurso de flota (persistido / resuelto). */
export type FleetStatus =
  | 'available'
  | 'scheduled'
  | 'in_use'
  | 'maintenance'
  | 'inactive';

export type ResolveFleetStatusInput = {
  status: FleetStatus;
  activeTripStatus?: TripLifecycleStatus;
  isActive: boolean;
  maintenanceFlag?: boolean;
};

export type { FleetOverviewAssetStatus, FleetOverviewOperationalStatus };
