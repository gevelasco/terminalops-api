import { BadRequestException } from '@nestjs/common';
import { IsNull, In, Not, Repository } from 'typeorm';
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';
import { Trip } from './entities/trip.entity';
import { TripEquipment } from './entities/trip-equipment.entity';

export type TripAssignmentResourceKind = 'unit' | 'operator' | 'equipment';

/** Bloquea asignación si el recurso ya está en otra maniobra activa. */
export async function assertResourceNotOnActiveTrip(
  tripsRepo: Repository<Trip>,
  tripEquipmentRepo: Repository<TripEquipment>,
  companyId: number,
  kind: TripAssignmentResourceKind,
  resourceId: number,
  resourceLabel: string,
  excludeTripId?: number,
): Promise<void> {
  let conflictingTrip: Trip | null = null;

  if (kind === 'unit' || kind === 'operator') {
    conflictingTrip = await tripsRepo.findOne({
      where: {
        companyId,
        ...(kind === 'unit'
          ? { unitId: resourceId }
          : { operatorId: resourceId }),
        status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
        deletedAt: IsNull(),
        ...(excludeTripId != null ? { id: Not(excludeTripId) } : {}),
      },
      select: ['id', 'maneuverCode', 'status'],
    });
  } else {
    const qb = tripEquipmentRepo
      .createQueryBuilder('te')
      .innerJoinAndSelect('te.trip', 'trip')
      .where('trip.company_id = :companyId', { companyId })
      .andWhere('te.equipment_id = :equipmentId', { equipmentId: resourceId })
      .andWhere('trip.status IN (:...statuses)', {
        statuses: [...TRIP_FLEET_ACTIVE_STATUSES],
      })
      .andWhere('trip.deleted_at IS NULL');
    if (excludeTripId != null) {
      qb.andWhere('trip.id != :excludeTripId', { excludeTripId });
    }
    const row = await qb.getOne();
    conflictingTrip = row?.trip ?? null;
  }

  if (conflictingTrip) {
    const code = conflictingTrip.maneuverCode?.trim() || String(conflictingTrip.id);
    throw new BadRequestException(
      `${resourceLabel} is already assigned to active trip ${code}`,
    );
  }
}
