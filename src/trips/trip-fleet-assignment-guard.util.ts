import { BadRequestException } from '@nestjs/common';
import { IsNull, In, Not, Repository } from 'typeorm';
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';
import { Trip } from './entities/trip.entity';
import { TripEquipment } from './entities/trip-equipment.entity';
import {
  tripScheduleWindowFromEntity,
  tripScheduleWindowsOverlap,
  type TripScheduleWindow,
} from './trip-schedule-overlap.util';

export type TripAssignmentResourceKind = 'unit' | 'operator' | 'equipment';

/** La maniobra ya terminó en el plan: no choca con quién está de viaje ahora. */
export function isCompletedHistoricalSchedule(
  plannedCompletionAt: Date,
  now = new Date(),
): boolean {
  return plannedCompletionAt.getTime() <= now.getTime();
}

const ACTIVE_TRIP_SELECT = [
  'id',
  'maneuverCode',
  'status',
  'plannedDepartureAt',
  'plannedCompletionAt',
  'returnAt',
  'unitId',
  'operatorId',
] as const;

async function loadActiveTripsForUnitOrOperator(
  tripsRepo: Repository<Trip>,
  companyId: number,
  kind: 'unit' | 'operator',
  resourceId: number,
  excludeTripId?: number,
): Promise<Trip[]> {
  return tripsRepo.find({
    where: {
      companyId,
      ...(kind === 'unit'
        ? { unitId: resourceId }
        : { operatorId: resourceId }),
      status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
      deletedAt: IsNull(),
      ...(excludeTripId != null ? { id: Not(excludeTripId) } : {}),
    },
    select: [...ACTIVE_TRIP_SELECT],
  });
}

async function loadActiveTripsForEquipment(
  tripEquipmentRepo: Repository<TripEquipment>,
  companyId: number,
  equipmentId: number,
  excludeTripId?: number,
): Promise<Trip[]> {
  const qb = tripEquipmentRepo
    .createQueryBuilder('te')
    .innerJoinAndSelect('te.trip', 'trip')
    .where('trip.company_id = :companyId', { companyId })
    .andWhere('te.equipment_id = :equipmentId', { equipmentId })
    .andWhere('trip.status IN (:...statuses)', {
      statuses: [...TRIP_FLEET_ACTIVE_STATUSES],
    })
    .andWhere('trip.deleted_at IS NULL');
  if (excludeTripId != null) {
    qb.andWhere('trip.id != :excludeTripId', { excludeTripId });
  }
  const rows = await qb.getMany();
  return rows.map((row) => row.trip).filter(Boolean);
}

function scheduleConflictMessage(
  resourceLabel: string,
  conflictingTrip: Trip,
): string {
  const code = conflictingTrip.maneuverCode?.trim() || String(conflictingTrip.id);
  return `${resourceLabel} ya tiene la maniobra activa ${code} en ese horario. Ajusta las fechas o elige otro recurso.`;
}

function pickScheduleConflict(
  trips: readonly Trip[],
  candidateWindow: TripScheduleWindow | undefined,
): Trip | null {
  if (trips.length === 0) {
    return null;
  }
  if (!candidateWindow) {
    return trips[0] ?? null;
  }
  for (const trip of trips) {
    const other = tripScheduleWindowFromEntity(trip);
    if (tripScheduleWindowsOverlap(candidateWindow, other)) {
      return trip;
    }
  }
  return null;
}

/** Bloquea asignación si el recurso tiene otra maniobra activa que se solapa en el tiempo. */
export async function assertResourceNotOnActiveTrip(
  tripsRepo: Repository<Trip>,
  tripEquipmentRepo: Repository<TripEquipment>,
  companyId: number,
  kind: TripAssignmentResourceKind,
  resourceId: number,
  resourceLabel: string,
  excludeTripId?: number,
  candidateWindow?: TripScheduleWindow,
): Promise<void> {
  const activeTrips =
    kind === 'equipment'
      ? await loadActiveTripsForEquipment(
          tripEquipmentRepo,
          companyId,
          resourceId,
          excludeTripId,
        )
      : await loadActiveTripsForUnitOrOperator(
          tripsRepo,
          companyId,
          kind,
          resourceId,
          excludeTripId,
        );

  const conflictingTrip = pickScheduleConflict(activeTrips, candidateWindow);
  if (conflictingTrip) {
    throw new BadRequestException(
      scheduleConflictMessage(resourceLabel, conflictingTrip),
    );
  }
}