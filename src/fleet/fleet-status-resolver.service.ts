import { Injectable } from '@nestjs/common';
import type { TripLifecycleStatus } from 'src/trips/lifecycle/trip-lifecycle.types';
import type {
  FleetOverviewOperationalStatus,
  FleetStatus,
  ResolveFleetStatusInput,
} from './fleet-status.types';
import {
  fleetOverviewOperationalSortRank,
  fleetStatusToOverviewOperationalStatus,
  fleetStatusToPersistedAssetStatus,
  normalizeFleetStatus,
  normalizePersistedAssetStatus,
  resolveFleetStatus,
} from './fleet-status-resolver.util';

@Injectable()
export class FleetStatusResolverService {
  normalizeFleetStatus(raw: string | null | undefined): FleetStatus {
    return normalizeFleetStatus(raw);
  }

  resolveFleetStatus(input: ResolveFleetStatusInput): FleetStatus {
    return resolveFleetStatus(input);
  }

  resolveOverviewOperationalStatus(input: {
    persistedStatus: string | null | undefined;
    activeTripStatus?: TripLifecycleStatus;
    isActive: boolean;
    maintenanceFlag?: boolean;
  }): FleetOverviewOperationalStatus {
    const resolved = resolveFleetStatus({
      status: normalizeFleetStatus(input.persistedStatus),
      activeTripStatus: input.activeTripStatus,
      isActive: input.isActive,
      maintenanceFlag:
        input.maintenanceFlag ??
        normalizeFleetStatus(input.persistedStatus) === 'maintenance',
    });
    return fleetStatusToOverviewOperationalStatus(resolved);
  }

  persistedAssetStatus(raw: string | null | undefined) {
    return normalizePersistedAssetStatus(raw);
  }

  resolvedAssetStatus(status: FleetStatus) {
    return fleetStatusToPersistedAssetStatus(status);
  }

  overviewSortRank(status: FleetOverviewOperationalStatus): number {
    return fleetOverviewOperationalSortRank(status);
  }
}
