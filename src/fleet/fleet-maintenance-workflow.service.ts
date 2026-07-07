import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { assertFleetResourceActive } from 'src/fleet/fleet-resource-active.util';
import { updateFleetResourceStatusCompareAndSet } from 'src/fleet/fleet-status-compare-set.util';
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';
import {
  canPersistedStatusEnterMaintenance,
  canPersistedStatusLeaveMaintenance,
} from 'src/fleet/fleet-maintenance-workflow.util';

@Injectable()
export class FleetMaintenanceWorkflowService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripEquipment)
    private readonly tripEquipmentRepo: Repository<TripEquipment>,
  ) {}

  async startUnitMaintenance(companyId: number, unitId: number): Promise<void> {
    const unit = await this.unitsRepo.findOne({
      where: { id: unitId, companyId },
      select: ['id', 'status', 'isActive'],
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    assertFleetResourceActive(unit.isActive, 'Unit');
    if (!canPersistedStatusEnterMaintenance(unit.status)) {
      throw new BadRequestException(
        'Only available units can enter maintenance',
      );
    }
    await this.assertUnitNotOnActiveTrip(companyId, unitId);
    await this.setUnitStatus(companyId, unitId, unit.status, 'maintenance');
  }

  async endUnitMaintenance(companyId: number, unitId: number): Promise<void> {
    const unit = await this.unitsRepo.findOne({
      where: { id: unitId, companyId },
      select: ['id', 'status', 'isActive'],
    });
    if (!unit) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    if (!canPersistedStatusLeaveMaintenance(unit.status)) {
      throw new BadRequestException(
        'Only units in maintenance can return to available',
      );
    }
    await this.assertUnitNotOnActiveTrip(companyId, unitId);
    await this.setUnitStatus(companyId, unitId, unit.status, 'available');
  }

  async startEquipmentMaintenance(
    companyId: number,
    equipmentId: number,
  ): Promise<void> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id: equipmentId, companyId },
      select: ['id', 'status', 'isActive'],
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    assertFleetResourceActive(equipment.isActive, 'Equipment');
    if (!canPersistedStatusEnterMaintenance(equipment.status)) {
      throw new BadRequestException(
        'Only available equipment can enter maintenance',
      );
    }
    await this.assertEquipmentNotOnActiveTrip(companyId, equipmentId);
    await this.setEquipmentStatus(
      companyId,
      equipmentId,
      equipment.status,
      'maintenance',
    );
  }

  async endEquipmentMaintenance(
    companyId: number,
    equipmentId: number,
  ): Promise<void> {
    const equipment = await this.equipmentRepo.findOne({
      where: { id: equipmentId, companyId },
      select: ['id', 'status', 'isActive'],
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    if (!canPersistedStatusLeaveMaintenance(equipment.status)) {
      throw new BadRequestException(
        'Only equipment in maintenance can return to available',
      );
    }
    await this.assertEquipmentNotOnActiveTrip(companyId, equipmentId);
    await this.setEquipmentStatus(
      companyId,
      equipmentId,
      equipment.status,
      'available',
    );
  }

  private async setUnitStatus(
    companyId: number,
    unitId: number,
    previousStatus: string | null | undefined,
    nextStatus: string,
  ): Promise<void> {
    const updated = await updateFleetResourceStatusCompareAndSet(
      this.unitsRepo,
      companyId,
      unitId,
      previousStatus,
      nextStatus,
    );
    if (!updated) {
      throw new BadRequestException('Unit status changed concurrently; retry');
    }
  }

  private async setEquipmentStatus(
    companyId: number,
    equipmentId: number,
    previousStatus: string | null | undefined,
    nextStatus: string,
  ): Promise<void> {
    const updated = await updateFleetResourceStatusCompareAndSet(
      this.equipmentRepo,
      companyId,
      equipmentId,
      previousStatus,
      nextStatus,
    );
    if (!updated) {
      throw new BadRequestException(
        'Equipment status changed concurrently; retry',
      );
    }
  }

  private async assertUnitNotOnActiveTrip(
    companyId: number,
    unitId: number,
  ): Promise<void> {
    const count = await this.tripsRepo.count({
      where: {
        companyId,
        unitId,
        status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
        deletedAt: IsNull(),
      },
    });
    if (count > 0) {
      throw new BadRequestException(
        'Unit is assigned to an active trip and cannot change maintenance state',
      );
    }
  }

  private async assertEquipmentNotOnActiveTrip(
    companyId: number,
    equipmentId: number,
  ): Promise<void> {
    const count = await this.tripsRepo
      .createQueryBuilder('trip')
      .innerJoin('trip.tripEquipment', 'te')
      .where('trip.company_id = :companyId', { companyId })
      .andWhere('te.equipment_id = :equipmentId', { equipmentId })
      .andWhere('trip.status IN (:...statuses)', {
        statuses: [...TRIP_FLEET_ACTIVE_STATUSES],
      })
      .andWhere('trip.deleted_at IS NULL')
      .getCount();
    if (count > 0) {
      throw new BadRequestException(
        'Equipment is assigned to an active trip and cannot change maintenance state',
      );
    }
  }
}
