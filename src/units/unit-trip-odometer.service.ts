import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, type EntityManager } from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { operationalKmFromStoredTrip } from 'src/trips/trip-operational-distance.util';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import {
  formatStoredKm,
  maintenanceKmControlActive,
  parseStoredKm,
  resolveMaintenanceKmInterval,
} from './unit-trip-odometer.util';

@Injectable()
export class UnitTripOdometerService {
  private readonly logger = new Logger(UnitTripOdometerService.name);

  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(UnitFleetProfile)
    private readonly profileRepo: Repository<UnitFleetProfile>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
  ) {}

  /** Suma km operativos de la maniobra al odómetro y contador de mantenimiento (idempotente). */
  async creditUnitForCompletedTrip(trip: Trip): Promise<void> {
    if (trip.unitId == null) {
      return;
    }
    if (trip.unitOdometerKmCredited != null && trip.unitOdometerKmCredited !== '') {
      return;
    }

    const km = operationalKmFromStoredTrip(
      parseStoredKm(trip.routeDistanceKm),
      parseStoredKm(trip.operationalDistanceKm),
      trip.isRoundTrip,
    );
    if (km == null || km <= 0) {
      return;
    }

    const credited = await this.tripsRepo.update(
      { id: trip.id, companyId: trip.companyId, unitOdometerKmCredited: IsNull() },
      { unitOdometerKmCredited: formatStoredKm(km) },
    );
    if ((credited.affected ?? 0) === 0) {
      return;
    }

    const applied = await this.applyKmDeltaToUnitProfile(
      trip.companyId,
      trip.unitId,
      km,
      'credit',
    );
    if (!applied) {
      await this.tripsRepo.update(
        { id: trip.id, companyId: trip.companyId },
        { unitOdometerKmCredited: null },
      );
      return;
    }

    this.logger.debug(
      `Unit ${trip.unitId} odometer +${km} km (trip ${trip.id} completed)`,
    );
  }

  /**
   * Revierte km acreditados al eliminar una maniobra completada.
   * Acepta un EntityManager para participar en la transacción de la eliminación
   * (limpiar el marcador y restar el odómetro deben ser atómicos).
   */
  async reverseCreditForTrip(trip: Trip, manager?: EntityManager): Promise<void> {
    const creditedMarker = trip.unitOdometerKmCredited;
    const km = parseStoredKm(creditedMarker);
    if (km == null || km <= 0 || trip.unitId == null || !creditedMarker) {
      return;
    }

    const tripsRepo = manager ? manager.getRepository(Trip) : this.tripsRepo;
    const cleared = await tripsRepo.update(
      {
        id: trip.id,
        companyId: trip.companyId,
        unitOdometerKmCredited: creditedMarker,
      },
      { unitOdometerKmCredited: null },
    );
    if ((cleared.affected ?? 0) === 0) {
      return;
    }

    await this.applyKmDeltaToUnitProfile(
      trip.companyId,
      trip.unitId,
      km,
      'reverse',
      manager,
    );

    this.logger.debug(
      `Unit ${trip.unitId} odometer -${km} km (trip ${trip.id} removed)`,
    );
  }

  /** Asegura contador en 0 al crear perfil si no se envió explícitamente. */
  async ensureMaintenanceKmCounterInitialized(
    unitId: number,
    profilePatch: { maintenanceKmCounter?: string | null },
  ): Promise<void> {
    if (profilePatch.maintenanceKmCounter != null) {
      return;
    }
    const profile = await this.profileRepo.findOne({ where: { unitId } });
    if (!profile || profile.maintenanceKmCounter != null) {
      return;
    }
    await this.profileRepo.update(
      { unitId },
      { maintenanceKmCounter: formatStoredKm(0) },
    );
  }

  private async applyKmDeltaToUnitProfile(
    companyId: number,
    unitId: number,
    km: number,
    mode: 'credit' | 'reverse',
    manager?: EntityManager,
  ): Promise<boolean> {
    const companiesRepo = manager
      ? manager.getRepository(Company)
      : this.companiesRepo;
    const profileRepo = manager
      ? manager.getRepository(UnitFleetProfile)
      : this.profileRepo;
    const [company, profile] = await Promise.all([
      companiesRepo.findOne({
        where: { id: companyId },
        select: [
          'id',
          'maintenanceKmControlEnabled',
          'maintenanceKmIntervalDefault',
        ],
      }),
      profileRepo.findOne({ where: { unitId } }),
    ]);
    if (!profile) {
      return false;
    }

    const sign = mode === 'credit' ? 1 : -1;
    const currentOdometer = parseStoredKm(profile.odometerKm) ?? 0;
    const nextOdometer = Math.max(0, currentOdometer + sign * km);

    const interval = resolveMaintenanceKmInterval(
      profile.maintenanceKmInterval,
      company?.maintenanceKmControlEnabled ?? false,
      company?.maintenanceKmIntervalDefault,
    );
    const kmControl = maintenanceKmControlActive(
      profile.maintenanceAlertByKm,
      company?.maintenanceKmControlEnabled ?? false,
    );

    const patch: Partial<UnitFleetProfile> = {
      odometerKm: formatStoredKm(nextOdometer),
    };

    if (kmControl && interval != null) {
      const currentCounter = parseStoredKm(profile.maintenanceKmCounter) ?? 0;
      const nextCounter =
        mode === 'credit'
          ? currentCounter + km
          : Math.max(0, currentCounter - km);
      patch.maintenanceKmCounter = formatStoredKm(nextCounter);
    }

    await profileRepo.update({ unitId }, patch);
    return true;
  }
}
