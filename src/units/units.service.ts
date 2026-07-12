import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeUnit } from 'src/common/serializers/unit.serializer';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
import { FleetBrandsService } from 'src/fleet/fleet-brands.service';
import {
  FLEET_BRAND_TYPE_UNIT,
  resolveFleetBrandNameFromPayload,
  resolveFleetVersionNameFromPayload,
} from 'src/fleet/utils/fleet-brand-from-payload.util';
import { pickUnitUserMutableFields } from 'src/fleet/fleet-resource-user-patch.util';
import { rejectClientFleetStatusMutation } from 'src/fleet/fleet-status-lock.util';
import { fleetTenureMapKey } from 'src/fleet/mappers/fleet-asset-tenure.mapper';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { UnitFleetDocument } from 'src/units/entities/unit-fleet-document.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import {
  fleetMetaDtoToDocuments,
  fleetMetaDtoToMaintenanceEntries,
  fleetMetaDtoToProfile,
} from './mappers/unit-fleet-meta.mapper';
import { UnitTripOdometerService } from './unit-trip-odometer.service';
import { FleetMaintenanceWorkflowService } from 'src/fleet/fleet-maintenance-workflow.service';
import { FleetMaintenanceExpenseSyncService } from 'src/fleet/fleet-maintenance-expense-sync.service';
import { FleetVerificationExpenseSyncService } from 'src/fleet/fleet-verification-expense-sync.service';
import { FleetInsuranceExpenseSyncService } from 'src/fleet/fleet-insurance-expense-sync.service';
import { FleetGpsExpenseSyncService } from 'src/fleet/fleet-gps-expense-sync.service';
import {
  unitFleetMetaGpsConfigTouched,
  unitFleetMetaGpsPaymentDateTouched,
  unitFleetMetaInsuranceConfigTouched,
  unitFleetMetaInsurancePaymentDateTouched,
  unitFleetMetaVerificationTouched,
} from 'src/fleet/fleet-meta-expense-sync-scope.util';

const UNIT_RELATIONS = [
  'fleetProfile',
  'maintenanceEntries',
  'fleetDocuments',
  'equipment',
] as const;

import {
  FLEET_ASSIGNABLE_LIST_STATUS,
  type FleetListAvailableOptions,
} from 'src/fleet/fleet-available-list.util';
import type { ListResourceLinkOptionsQueryDto } from 'src/common/dto/list-resource-link-options-query.dto';
import { isFleetLinkOptionsSearchAllowed } from 'src/fleet/fleet-link-options-search.util';
import { mapUnitLinkOption } from './unit-link-option.mapper';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { COMPANY_ACTIVITY_KIND } from 'src/activity-events/company-activity-event.kinds';
import { buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';
import type AuthUser from 'src/types/auth-user.type';

export type UnitsFindAllOptions = FleetListAvailableOptions & {
  includeTenure?: boolean;
};

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly repo: Repository<Unit>,
    @InjectRepository(UnitFleetProfile)
    private readonly profileRepo: Repository<UnitFleetProfile>,
    @InjectRepository(FleetMaintenanceEntry)
    private readonly maintenanceRepo: Repository<FleetMaintenanceEntry>,
    @InjectRepository(UnitFleetDocument)
    private readonly documentsRepo: Repository<UnitFleetDocument>,
    private readonly fleetTenureService: FleetTenureService,
    private readonly fleetBrandsService: FleetBrandsService,
    private readonly unitTripOdometer: UnitTripOdometerService,
    private readonly maintenanceWorkflow: FleetMaintenanceWorkflowService,
    private readonly maintenanceExpenseSync: FleetMaintenanceExpenseSyncService,
    private readonly verificationExpenseSync: FleetVerificationExpenseSyncService,
    private readonly insuranceExpenseSync: FleetInsuranceExpenseSyncService,
    private readonly gpsExpenseSync: FleetGpsExpenseSyncService,
    private readonly activityEvents: ActivityEventsService,
  ) {}

  async create(companyId: number, dto: CreateUnitDto, actor?: AuthUser) {
    rejectClientFleetStatusMutation(dto as unknown as Record<string, unknown>);
    const { fleetMeta, ...rawCore } = dto;
    const core = pickUnitUserMutableFields(
      rawCore as unknown as Record<string, unknown>,
    );
    await this.ensureUnitBrand(companyId, fleetMeta, core.trailerBrandAbbr as string | undefined);
    const saved = await this.repo.save(
      this.repo.create({
        ...core,
        companyId,
        status: 'available',
      } as Partial<Unit>),
    );
    if (fleetMeta) {
      await this.saveFleetMeta(companyId, saved.id, fleetMeta);
    }
    const label = buildUnitOperationalId(saved);
    await this.activityEvents.record({
      companyId,
      kind: COMPANY_ACTIVITY_KIND.UNIT_CREATED,
      entityType: 'unit',
      entityId: saved.id,
      subjectLabel: label,
      title: 'Alta de unidad',
      actor,
    });
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number, options?: UnitsFindAllOptions) {
    const rows = await this.repo.find({
      where: options?.available
        ? { companyId, isActive: true, status: FLEET_ASSIGNABLE_LIST_STATUS }
        : { companyId },
      relations: [...UNIT_RELATIONS],
      order: { plate: 'ASC' },
    });
    const tenureByKey = options?.includeTenure
      ? this.fleetTenureService.buildLookupMap(
          await this.fleetTenureService.findAllForCompany(companyId),
        )
      : null;
    return rows.map((row) =>
      serializeUnit(row, {
        tenure: tenureByKey?.get(fleetTenureMapKey({ unitId: row.id })),
      }),
    );
  }

  async findLinkOptions(
    companyId: number,
    query: ListResourceLinkOptionsQueryDto = {},
  ) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const idRaw = query.id?.trim();
    if (idRaw) {
      const id = Number(idRaw);
      if (Number.isFinite(id) && id > 0) {
        const row = await this.repo.findOne({ where: { companyId, id } });
        return { items: row ? [mapUnitLinkOption(row)] : [] };
      }
      return { items: [] };
    }

    const search = query.search?.trim();
    if (!isFleetLinkOptionsSearchAllowed(search)) {
      return { items: [] };
    }

    const rows = await this.repo
      .createQueryBuilder('unit')
      .select([
        'unit.id',
        'unit.trailerBrandAbbr',
        'unit.trailerYear',
        'unit.plate',
        'unit.status',
        'unit.isActive',
      ])
      .where('unit.companyId = :companyId', { companyId })
      .andWhere(
        `(
          unit.plate ILIKE :q OR
          unit.trailer_brand_abbr ILIKE :q OR
          CAST(unit.id AS TEXT) ILIKE :q
        )`,
        { q: `%${search}%` },
      )
      .orderBy('unit.plate', 'ASC')
      .take(limit)
      .getMany();

    return { items: rows.map(mapUnitLinkOption) };
  }

  async findOne(companyId: number, unitId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: unitId },
      relations: [...UNIT_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    const tenure = await this.fleetTenureService.findByUnit(companyId, unitId);
    return serializeUnit(row, { tenure });
  }

  async update(
    companyId: number,
    unitId: number,
    dto: UpdateUnitDto,
    actor?: AuthUser,
  ) {
    rejectClientFleetStatusMutation(dto as unknown as Record<string, unknown>);
    await this.findOne(companyId, unitId);
    const { fleetMeta, ...rawCore } = dto;
    const core = pickUnitUserMutableFields(
      rawCore as unknown as Record<string, unknown>,
    );
    await this.ensureUnitBrand(
      companyId,
      fleetMeta,
      core.trailerBrandAbbr as string | undefined,
    );
    if (Object.keys(core).length > 0) {
      await this.repo.update({ id: unitId, companyId }, core);
    }
    if (fleetMeta !== undefined) {
      await this.saveFleetMeta(companyId, unitId, fleetMeta);
    }
    const row = await this.repo.findOne({ where: { companyId, id: unitId } });
    if (row) {
      await this.activityEvents.record({
        companyId,
        kind: COMPANY_ACTIVITY_KIND.UNIT_UPDATED,
        entityType: 'unit',
        entityId: unitId,
        subjectLabel: buildUnitOperationalId(row),
        title: 'Unidad modificada',
        actor,
      });
    }
    return this.findOne(companyId, unitId);
  }

  async remove(companyId: number, unitId: number) {
    await this.findOne(companyId, unitId);
    await this.repo.delete({ id: unitId, companyId });
    return { id: unitId, deleted: true };
  }

  async startMaintenance(companyId: number, unitId: number) {
    await this.maintenanceWorkflow.startUnitMaintenance(companyId, unitId);
    return this.findOne(companyId, unitId);
  }

  async endMaintenance(companyId: number, unitId: number) {
    await this.maintenanceWorkflow.endUnitMaintenance(companyId, unitId);
    return this.findOne(companyId, unitId);
  }

  async syncInsuranceExpenses(companyId: number, unitId: number) {
    await this.findOne(companyId, unitId);
    const existing = await this.profileRepo.findOne({ where: { unitId } });
    if (existing) {
      await this.insuranceExpenseSync.ensureInitialInsurancePremium({
        companyId,
        insuranceTarget: 'unit',
        relatedUnitId: unitId,
        previous: existing,
      });
    }
    return this.findOne(companyId, unitId);
  }

  private async saveFleetMeta(
    companyId: number,
    unitId: number,
    fleetMeta: NonNullable<CreateUnitDto['fleetMeta']>,
  ): Promise<void> {
    const existing = await this.profileRepo.findOne({ where: { unitId } });
    const mapped = fleetMetaDtoToProfile(unitId, fleetMeta);
    const profileRow: Partial<UnitFleetProfile> = { unitId };
    for (const [key, value] of Object.entries(mapped)) {
      if (key !== 'unitId' && value !== undefined) {
        (profileRow as Record<string, unknown>)[key] = value;
      }
    }
    await this.profileRepo.save(
      this.profileRepo.create({
        ...(existing ?? {}),
        ...profileRow,
      }),
    );

    if (unitFleetMetaVerificationTouched(existing, fleetMeta)) {
      await this.verificationExpenseSync.syncForUnitVerificationSave({
        companyId,
        unitId,
        previous: existing,
        incoming: fleetMeta,
      });
    }

    if (unitFleetMetaInsurancePaymentDateTouched(existing, fleetMeta)) {
      await this.insuranceExpenseSync.syncForInsurancePaymentSave({
        companyId,
        insuranceTarget: 'unit',
        relatedUnitId: unitId,
        previous: existing,
        incoming: fleetMeta,
      });
    } else if (unitFleetMetaInsuranceConfigTouched(existing, fleetMeta)) {
      await this.insuranceExpenseSync.ensureInitialInsurancePremium({
        companyId,
        insuranceTarget: 'unit',
        relatedUnitId: unitId,
        previous: existing,
        incoming: fleetMeta,
      });
    }

    if (unitFleetMetaGpsPaymentDateTouched(existing, fleetMeta)) {
      await this.gpsExpenseSync.syncForGpsPaymentSave({
        companyId,
        relatedUnitId: unitId,
        previous: existing,
        incoming: fleetMeta,
      });
    } else if (unitFleetMetaGpsConfigTouched(existing, fleetMeta)) {
      await this.gpsExpenseSync.ensureInitialGpsService({
        companyId,
        relatedUnitId: unitId,
        previous: existing,
        incoming: fleetMeta,
      });
    }

    await this.unitTripOdometer.ensureMaintenanceKmCounterInitialized(unitId, {
      maintenanceKmCounter: profileRow.maintenanceKmCounter ?? null,
    });

    await this.fleetTenureService.upsertFromFleetMeta(companyId, { unitId }, fleetMeta);

    if (fleetMeta.maintenanceEntries !== undefined) {
      const previous = await this.maintenanceRepo.find({
        where: { unitId },
        order: { sortOrder: 'ASC' },
      });
      await this.maintenanceRepo.delete({ unitId });
      const maintenanceRows = fleetMetaDtoToMaintenanceEntries(unitId, fleetMeta);
      if (maintenanceRows.length > 0) {
        await this.maintenanceRepo.save(
          maintenanceRows.map((row) => this.maintenanceRepo.create(row)),
        );
      }
      await this.maintenanceExpenseSync.syncForMaintenanceSave({
        companyId,
        maintenanceTarget: 'unit',
        relatedUnitId: unitId,
        previous,
        incoming: fleetMeta.maintenanceEntries,
      });
    }

    const hasDocumentPayload =
      fleetMeta.documentMaintenanceNames !== undefined ||
      fleetMeta.documentVerificationNames !== undefined ||
      fleetMeta.documentPolicyNames !== undefined ||
      fleetMeta.documentOwnershipNames !== undefined;
    if (hasDocumentPayload) {
      await this.documentsRepo.delete({ unitId });
      const documentRows = fleetMetaDtoToDocuments(unitId, fleetMeta);
      if (documentRows.length > 0) {
        await this.documentsRepo.save(
          documentRows.map((row) => this.documentsRepo.create(row)),
        );
      }
    }
  }

  private async ensureUnitBrand(
    companyId: number,
    fleetMeta: CreateUnitDto['fleetMeta'] | UpdateUnitDto['fleetMeta'] | undefined,
    trailerBrandAbbr?: string,
  ): Promise<void> {
    const brandName = resolveFleetBrandNameFromPayload(fleetMeta, trailerBrandAbbr);
    if (!brandName) {
      return;
    }
    const brand = await this.fleetBrandsService.findOrCreateBrand(
      companyId,
      FLEET_BRAND_TYPE_UNIT,
      brandName,
    );
    if (!brand) {
      return;
    }
    const versionName = resolveFleetVersionNameFromPayload(fleetMeta);
    if (versionName) {
      await this.fleetBrandsService.findOrCreateVersion(brand.id, versionName);
    }
  }
}
