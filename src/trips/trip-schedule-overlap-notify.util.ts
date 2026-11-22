import type { Trip } from './entities/trip.entity';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { COMPANY_ACTIVITY_KIND } from 'src/activity-events/company-activity-event.kinds';
import type AuthUser from 'src/types/auth-user.type';
import {
  findScheduleOverlapsAmongTrips,
  tripScheduleWindowFromEntity,
} from './trip-schedule-overlap.util';

export async function recordTripScheduleOverlapWarnings(
  activityEvents: ActivityEventsService,
  params: {
    companyId: number;
    sourceTrip: Trip;
    sourceEquipmentIds: readonly number[];
    peerTrips: readonly Trip[];
    actor?: AuthUser | null;
  },
): Promise<void> {
  const window = tripScheduleWindowFromEntity(params.sourceTrip);
  const overlaps = findScheduleOverlapsAmongTrips(
    window,
    params.peerTrips,
    params.sourceTrip,
    params.sourceEquipmentIds,
    params.sourceTrip.id,
  );
  for (const other of overlaps) {
    const sourceCode =
      params.sourceTrip.maneuverCode?.trim() || String(params.sourceTrip.id);
    const otherCode = other.maneuverCode?.trim() || String(other.id);
    await activityEvents.record({
      companyId: params.companyId,
      kind: COMPANY_ACTIVITY_KIND.TRIP_SCHEDULE_OVERLAP,
      entityType: 'trip',
      entityId: other.id,
      subjectLabel: otherCode,
      title:
        `Revisar reprogramación: ${otherCode} podría solaparse con ${sourceCode} tras el cambio de fechas.`,
      actor: params.actor,
      metadata: {
        tripId: other.id,
        conflictingTripId: params.sourceTrip.id,
        conflictingManeuverCode: sourceCode,
      },
      dedupeKey: `trip-schedule-overlap:${params.sourceTrip.id}:${other.id}:${window.endMs}`,
    });
  }
}