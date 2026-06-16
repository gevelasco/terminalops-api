import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { Unit } from 'src/units/entities/unit.entity';
import {
  isProtectedFleetStatus,
  resolveFleetTargetForResource,
  TRIP_FLEET_ACTIVE_STATUSES,
  type FleetResourceKind,
} from './trip-fleet-status-sync.util';

export type TripFleetSyncSource = Pick<
  Trip,
  'id' | 'companyId' | 'status' | 'unitId' | 'operatorId'
>;

/** Recursos desasignados en un update de maniobra (requieren recálculo). */
export interface TripFleetReleasedResources {
  unitIds: number[];
  operatorIds: number[];
  equipmentIds: number[];
}

/**
 * Sincroniza status operativos de flota con maniobras activas.
 * Solo aplica si la empresa tiene `operationalAnalysisEnabled`.
 */
@Injectable()
export class TripFleetStatusSyncService {
  private readonly logger = new Logger(TripFleetStatusSyncService.name);

  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripEquipment)
    private readonly tripEquipmentRepo: Repository<TripEquipment>,
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
  ) {}

  async syncForTrip(trip: TripFleetSyncSource): Promise<void> {
    if (!(await this.isOperationalSyncEnabled(trip.companyId))) {
      return;
    }

    const equipmentIds = await this.loadEquipmentIdsForTrip(trip.id);
    const tasks: Promise<void>[] = [];

    if (trip.unitId != null) {
      tasks.push(
        this.syncUnitFromActiveTrips(trip.companyId, trip.unitId),
      );
    }
    if (trip.operatorId != null) {
      tasks.push(
        this.syncOperatorFromActiveTrips(trip.companyId, trip.operatorId),
      );
    }
    for (const equipmentId of equipmentIds) {
      tasks.push(
        this.syncEquipmentFromActiveTrips(trip.companyId, equipmentId),
      );
    }

    await Promise.all(tasks);
  }

  /**
   * Sincroniza recursos actuales del trip y recursos liberados en un update.
   * Reutiliza el mismo algoritmo de dominancia (in_transit > scheduled > available).
   */
  /**
   * Reconcilia estatus en BD para maniobras activas y recursos con estado operativo
   * desfasado (p. ej. datos previos al motor de sync).
   */
  async reconcileCompanyFleetOperationalStatus(companyId: number): Promise<void> {
    if (!(await this.isOperationalSyncEnabled(companyId))) {
      return;
    }

    const activeTrips = await this.tripsRepo.find({
      where: { companyId, status: In([...TRIP_FLEET_ACTIVE_STATUSES]) },
      select: ['id', 'unitId', 'operatorId'],
    });

    const unitIds = new Set<number>();
    const operatorIds = new Set<number>();
    const equipmentIds = new Set<number>();

    for (const trip of activeTrips) {
      if (trip.unitId != null) {
        unitIds.add(trip.unitId);
      }
      if (trip.operatorId != null) {
        operatorIds.add(trip.operatorId);
      }
      for (const equipmentId of await this.loadEquipmentIdsForTrip(trip.id)) {
        equipmentIds.add(equipmentId);
      }
    }

    const tasks: Promise<void>[] = [];
    for (const unitId of unitIds) {
      tasks.push(this.syncUnitFromActiveTrips(companyId, unitId));
    }
    for (const operatorId of operatorIds) {
      tasks.push(this.syncOperatorFromActiveTrips(companyId, operatorId));
    }
    for (const equipmentId of equipmentIds) {
      tasks.push(this.syncEquipmentFromActiveTrips(companyId, equipmentId));
    }

    const staleUnits = await this.unitsRepo.find({
      where: { companyId, status: In(['in_use', 'scheduled']) },
      select: ['id'],
    });
    for (const unit of staleUnits) {
      if (!unitIds.has(unit.id)) {
        tasks.push(this.syncUnitFromActiveTrips(companyId, unit.id));
      }
    }

    const staleOperators = await this.operatorsRepo.find({
      where: { companyId, status: In(['on_route', 'scheduled']) },
      select: ['id'],
    });
    for (const operator of staleOperators) {
      if (!operatorIds.has(operator.id)) {
        tasks.push(this.syncOperatorFromActiveTrips(companyId, operator.id));
      }
    }

    const staleEquipment = await this.equipmentRepo.find({
      where: { companyId, status: In(['in_use', 'scheduled']) },
      select: ['id'],
    });
    for (const eq of staleEquipment) {
      if (!equipmentIds.has(eq.id)) {
        tasks.push(this.syncEquipmentFromActiveTrips(companyId, eq.id));
      }
    }

    await Promise.all(tasks);
  }

  async syncForTripAfterUpdate(
    trip: TripFleetSyncSource,
    released: TripFleetReleasedResources,
  ): Promise<void> {
    if (!(await this.isOperationalSyncEnabled(trip.companyId))) {
      return;
    }

    const currentEquipmentIds = await this.loadEquipmentIdsForTrip(trip.id);
    const unitIds = new Set<number>();
    const operatorIds = new Set<number>();
    const equipmentIds = new Set<number>();

    if (trip.unitId != null) {
      unitIds.add(trip.unitId);
    }
    if (trip.operatorId != null) {
      operatorIds.add(trip.operatorId);
    }
    for (const equipmentId of currentEquipmentIds) {
      equipmentIds.add(equipmentId);
    }
    for (const unitId of released.unitIds) {
      unitIds.add(unitId);
    }
    for (const operatorId of released.operatorIds) {
      operatorIds.add(operatorId);
    }
    for (const equipmentId of released.equipmentIds) {
      equipmentIds.add(equipmentId);
    }

    const tasks: Promise<void>[] = [];
    for (const unitId of unitIds) {
      tasks.push(this.syncUnitFromActiveTrips(trip.companyId, unitId));
    }
    for (const operatorId of operatorIds) {
      tasks.push(this.syncOperatorFromActiveTrips(trip.companyId, operatorId));
    }
    for (const equipmentId of equipmentIds) {
      tasks.push(
        this.syncEquipmentFromActiveTrips(trip.companyId, equipmentId),
      );
    }

    await Promise.all(tasks);
  }

  private async isOperationalSyncEnabled(companyId: number): Promise<boolean> {
    const company = await this.companiesRepo.findOne({
      where: { id: companyId },
      select: ['id', 'operationalAnalysisEnabled'],
    });
    return company?.operationalAnalysisEnabled !== false;
  }

  private async loadEquipmentIdsForTrip(tripId: number): Promise<number[]> {
    const rows = await this.tripEquipmentRepo.find({
      where: { tripId },
      select: ['equipmentId'],
    });
    return rows.map((row) => row.equipmentId);
  }

  private async syncUnitFromActiveTrips(
    companyId: number,
    unitId: number,
  ): Promise<void> {
    const statuses = await this.findActiveTripStatusesForUnit(companyId, unitId);
    await this.applyResourceStatus('unit', unitId, companyId, statuses);
    const equipmentTarget = resolveFleetTargetForResource('equipment', statuses);
    await this.syncHitchedEquipmentForUnit(companyId, unitId, equipmentTarget);
  }

  /** Equipo enganchado a la unidad sigue el mismo estatus operativo del convoy. */
  private async syncHitchedEquipmentForUnit(
    companyId: number,
    unitId: number,
    equipmentTarget: string,
  ): Promise<void> {
    const hitched = await this.equipmentRepo.find({
      where: { companyId, unitId },
      select: ['id', 'status'],
    });
    for (const row of hitched) {
      const ownTripStatuses = await this.findActiveTripStatusesForEquipment(
        companyId,
        row.id,
      );
      if (ownTripStatuses.length > 0) {
        await this.applyResourceStatus(
          'equipment',
          row.id,
          companyId,
          ownTripStatuses,
        );
        continue;
      }
      if (isProtectedFleetStatus('equipment', row.status)) {
        continue;
      }
      if ((row.status ?? '') === equipmentTarget) {
        continue;
      }
      await this.equipmentRepo.update(
        { id: row.id, companyId },
        { status: equipmentTarget },
      );
      this.logger.debug(
        `Equipment ${row.id} (hitched to unit ${unitId}) status → ${equipmentTarget}`,
      );
    }
  }

  private async syncOperatorFromActiveTrips(
    companyId: number,
    operatorId: number,
  ): Promise<void> {
    const statuses = await this.findActiveTripStatusesForOperator(
      companyId,
      operatorId,
    );
    await this.applyResourceStatus(
      'operator',
      operatorId,
      companyId,
      statuses,
    );
  }

  private async syncEquipmentFromActiveTrips(
    companyId: number,
    equipmentId: number,
  ): Promise<void> {
    const statuses = await this.findActiveTripStatusesForEquipment(
      companyId,
      equipmentId,
    );
    await this.applyResourceStatus(
      'equipment',
      equipmentId,
      companyId,
      statuses,
    );
  }

  private async findActiveTripStatusesForUnit(
    companyId: number,
    unitId: number,
  ): Promise<string[]> {
    const rows = await this.tripsRepo.find({
      where: {
        companyId,
        unitId,
        status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
      },
      select: ['status'],
    });
    return rows.map((row) => row.status);
  }

  private async findActiveTripStatusesForOperator(
    companyId: number,
    operatorId: number,
  ): Promise<string[]> {
    const rows = await this.tripsRepo.find({
      where: {
        companyId,
        operatorId,
        status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
      },
      select: ['status'],
    });
    return rows.map((row) => row.status);
  }

  private async findActiveTripStatusesForEquipment(
    companyId: number,
    equipmentId: number,
  ): Promise<string[]> {
    const rows = await this.tripsRepo
      .createQueryBuilder('trip')
      .innerJoin('trip.tripEquipment', 'te')
      .where('trip.company_id = :companyId', { companyId })
      .andWhere('te.equipment_id = :equipmentId', { equipmentId })
      .andWhere('trip.status IN (:...statuses)', {
        statuses: [...TRIP_FLEET_ACTIVE_STATUSES],
      })
      .select(['trip.status'])
      .getMany();
    return rows.map((row) => row.status);
  }

  private async applyResourceStatus(
    kind: FleetResourceKind,
    resourceId: number,
    companyId: number,
    activeTripStatuses: string[],
  ): Promise<void> {
    const target = resolveFleetTargetForResource(kind, activeTripStatuses);

    if (kind === 'unit') {
      const row = await this.unitsRepo.findOne({
        where: { id: resourceId, companyId },
        select: ['id', 'status'],
      });
      if (!row || isProtectedFleetStatus('unit', row.status)) {
        return;
      }
      if (row.status === target) {
        return;
      }
      await this.unitsRepo.update({ id: resourceId, companyId }, { status: target });
      this.logger.debug(`Unit ${resourceId} status → ${target}`);
      return;
    }

    if (kind === 'operator') {
      const row = await this.operatorsRepo.findOne({
        where: { id: resourceId, companyId },
        select: ['id', 'status'],
      });
      if (!row || isProtectedFleetStatus('operator', row.status)) {
        return;
      }
      if (row.status === target) {
        return;
      }
      await this.operatorsRepo.update(
        { id: resourceId, companyId },
        { status: target },
      );
      this.logger.debug(`Operator ${resourceId} status → ${target}`);
      return;
    }

    const row = await this.equipmentRepo.findOne({
      where: { id: resourceId, companyId },
      select: ['id', 'status'],
    });
    if (!row || isProtectedFleetStatus('equipment', row.status)) {
      return;
    }
    if ((row.status ?? '') === target) {
      return;
    }
    await this.equipmentRepo.update(
      { id: resourceId, companyId },
      { status: target },
    );
    this.logger.debug(`Equipment ${resourceId} status → ${target}`);
  }
}
