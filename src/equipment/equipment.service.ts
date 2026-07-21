import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeEquipment } from 'src/common/serializers/equipment.serializer';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
import { FleetBrandsService } from 'src/fleet/fleet-brands.service';
import {
  FLEET_BRAND_TYPE_EQUIPMENT,
  resolveFleetBrandNameFromPayload,
  resolveFleetVersionNameFromPayload,
} from 'src/fleet/utils/fleet-brand-from-payload.util';
import { Unit } from 'src/units/entities/unit.entity';
import { assertFleetResourceActive } from 'src/fleet/fleet-resource-active.util';
import { pickEquipmentUserMutableFields } from 'src/fleet/fleet-resource-user-patch.util';
import { rejectClientFleetStatusMutation } from 'src/fleet/fleet-status-lock.util';
import { EquipmentFleetDocument } from 'src/equipment/entities/equipment-fleet-document.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import {
  fleetMetaDtoToDocuments,
  fleetMetaDtoToMaintenanceEntries,
  fleetMetaDtoToProfile,
  fleetMetaDtoToVerificationEntries,
  lastMaintenanceScalarsProvided,
  verificationMetaFromEntries,
} from './mappers/equipment-fleet-meta.mapper';
import {
  mergeVerificationHistoryOnScalarSave,
  resolveVerificationEntriesFromMeta,
  verificationEntriesToMetaScalars,
} from 'src/fleet/fleet-verification-entries.util';
import {
  assertEquipmentHitchAssignmentAllowed,
  assertUnitCanHitchEquipment,
} from './equipment-hitch-validation.util';
import { FleetMaintenanceWorkflowService } from 'src/fleet/fleet-maintenance-workflow.service';
import { FleetMaintenanceExpenseSyncService } from 'src/fleet/fleet-maintenance-expense-sync.service';
import { FleetVerificationExpenseSyncService } from 'src/fleet/fleet-verification-expense-sync.service';
import { FleetInsuranceExpenseSyncService } from 'src/fleet/fleet-insurance-expense-sync.service';
import { FleetTenureExpenseSyncService } from 'src/fleet/fleet-tenure-expense-sync.service';
import {
  unitFleetMetaInsuranceTouched,
  unitFleetMetaVerificationTouched,
} from 'src/fleet/fleet-meta-expense-sync-scope.util';
import type { ListResourceLinkOptionsQueryDto } from 'src/common/dto/list-resource-link-options-query.dto';
import { isFleetLinkOptionsSearchAllowed } from 'src/fleet/fleet-link-options-search.util';
import { mapEquipmentLinkOption } from './equipment-link-option.mapper';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { COMPANY_ACTIVITY_KIND } from 'src/activity-events/company-activity-event.kinds';
import { buildEquipmentOperationalId } from 'src/common/utils/unit-operational-id.util';
import type AuthUser from 'src/types/auth-user.type';

export type EquipmentFindAllOptions = { includeTenure?: boolean };

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly repo: Repository<Equipment>,
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(EquipmentFleetProfile)
    private readonly profileRepo: Repository<EquipmentFleetProfile>,
    @InjectRepository(FleetMaintenanceEntry)
    private readonly maintenanceRepo: Repository<FleetMaintenanceEntry>,
    @InjectRepository(FleetVerificationEntry)
    private readonly verificationRepo: Repository<FleetVerificationEntry>,
    @InjectRepository(EquipmentFleetDocument)
    private readonly documentsRepo: Repository<EquipmentFleetDocument>,
    private readonly fleetTenureService: FleetTenureService,
    private readonly fleetBrandsService: FleetBrandsService,
    private readonly maintenanceWorkflow: FleetMaintenanceWorkflowService,
    private readonly maintenanceExpenseSync: FleetMaintenanceExpenseSyncService,
    private readonly verificationExpenseSync: FleetVerificationExpenseSyncService,
    private readonly insuranceExpenseSync: FleetInsuranceExpenseSyncService,
    private readonly tenureExpenseSync: FleetTenureExpenseSyncService,
    private readonly activityEvents: ActivityEventsService,
  ) {}

  async create(companyId: number, dto: CreateEquipmentDto, actor?: AuthUser) {
    rejectClientFleetStatusMutation(dto as unknown as Record<string, unknown>);
    const { fleetMeta, unitId: unitIdRef, hitchPosition, ...rawCore } = dto;
    const core = pickEquipmentUserMutableFields(
      rawCore as unknown as Record<string, unknown>,
    );
    await this.ensureEquipmentBrand(companyId, fleetMeta);
    const unitId = unitIdRef
      ? await this.resolveUnitId(companyId, unitIdRef)
      : undefined;
    const resolvedPosition = unitId ? hitchPosition ?? 'lead' : null;
    if (unitId) {
      await this.assertHitchSlotAvailable(companyId, unitId, resolvedPosition);
    }
    const saved = await this.repo.save(
      this.repo.create({
        ...core,
        companyId,
        unitId,
        hitchPosition: resolvedPosition,
        status: 'available',
      }),
    );
    if (fleetMeta) {
      await this.saveFleetMeta(companyId, saved.id, fleetMeta);
    }
    const label = buildEquipmentOperationalId(saved);
    await this.activityEvents.record({
      companyId,
      kind: COMPANY_ACTIVITY_KIND.EQUIPMENT_CREATED,
      entityType: 'equipment',
      entityId: saved.id,
      subjectLabel: label,
      title: 'Alta de equipo',
      actor,
    });
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number, options?: EquipmentFindAllOptions) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: ['fleetProfile', 'maintenanceEntries', 'verificationEntries'],
      order: { name: 'ASC' },
    });
    return rows.map((row) => serializeEquipment(row, { list: true }));
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
        return { items: row ? [mapEquipmentLinkOption(row)] : [] };
      }
      return { items: [] };
    }

    const search = query.search?.trim();
    if (!isFleetLinkOptionsSearchAllowed(search)) {
      return { items: [] };
    }

    const rows = await this.repo
      .createQueryBuilder('equipment')
      .select([
        'equipment.id',
        'equipment.trailerBrandAbbr',
        'equipment.trailerYear',
        'equipment.plate',
        'equipment.status',
        'equipment.isActive',
      ])
      .where('equipment.companyId = :companyId', { companyId })
      .andWhere(
        `(
          equipment.plate ILIKE :q OR
          equipment.name ILIKE :q OR
          equipment.trailer_brand_abbr ILIKE :q OR
          CAST(equipment.id AS TEXT) ILIKE :q
        )`,
        { q: `%${search}%` },
      )
      .orderBy('equipment.name', 'ASC')
      .take(limit)
      .getMany();

    return { items: rows.map(mapEquipmentLinkOption) };
  }

  async findOne(companyId: number, equipmentId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: equipmentId },
      relations: ['unit', 'fleetProfile', 'maintenanceEntries', 'verificationEntries', 'fleetDocuments'],
    });
    if (!row) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    const tenure = await this.fleetTenureService.findByEquipment(companyId, equipmentId);
    return serializeEquipment(row, { tenure });
  }

  async update(
    companyId: number,
    equipmentId: number,
    dto: UpdateEquipmentDto,
    actor?: AuthUser,
  ) {
    rejectClientFleetStatusMutation(dto as unknown as Record<string, unknown>);
    const current = await this.repo.findOne({
      where: { companyId, id: equipmentId },
    });
    if (!current) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    const { unitId: unitIdRef, fleetMeta, hitchPosition, ...rawRest } = dto;
    const rest = pickEquipmentUserMutableFields(
      rawRest as unknown as Record<string, unknown>,
    );
    const unitId =
      unitIdRef !== undefined
        ? unitIdRef == null || String(unitIdRef).trim() === ''
          ? undefined
          : await this.resolveUnitId(companyId, unitIdRef)
        : undefined;
    const corePatch: Record<string, unknown> = { ...rest };
    let nextUnitId = current.unitId ?? null;
    let nextHitchPosition = current.hitchPosition ?? null;
    if (unitIdRef !== undefined) {
      nextUnitId = unitId ?? null;
      nextHitchPosition = nextUnitId ? hitchPosition ?? 'lead' : null;
      corePatch['unitId'] = nextUnitId;
      corePatch['hitchPosition'] = nextHitchPosition;
    } else if (hitchPosition !== undefined) {
      nextHitchPosition = nextUnitId ? hitchPosition : null;
      corePatch['hitchPosition'] = nextHitchPosition;
    }
    if (nextUnitId) {
      await this.assertHitchSlotAvailable(
        companyId,
        nextUnitId,
        nextHitchPosition,
        equipmentId,
      );
    }
    await this.ensureEquipmentBrand(companyId, fleetMeta);
    if (Object.keys(corePatch).length > 0) {
      await this.repo.update({ id: equipmentId, companyId }, corePatch);
    }
    if (fleetMeta !== undefined) {
      await this.saveFleetMeta(companyId, equipmentId, fleetMeta);
    }
    const row = await this.repo.findOne({ where: { companyId, id: equipmentId } });
    if (row) {
      await this.activityEvents.record({
        companyId,
        kind: COMPANY_ACTIVITY_KIND.EQUIPMENT_UPDATED,
        entityType: 'equipment',
        entityId: equipmentId,
        subjectLabel: buildEquipmentOperationalId(row),
        title: 'Equipo modificado',
        actor,
      });
    }
    return this.findOne(companyId, equipmentId);
  }

  async remove(companyId: number, equipmentId: number) {
    await this.findOne(companyId, equipmentId);
    await this.repo.delete({ id: equipmentId, companyId });
    return { id: equipmentId, deleted: true };
  }

  async startMaintenance(companyId: number, equipmentId: number) {
    await this.maintenanceWorkflow.startEquipmentMaintenance(companyId, equipmentId);
    return this.findOne(companyId, equipmentId);
  }

  async endMaintenance(companyId: number, equipmentId: number) {
    await this.maintenanceWorkflow.endEquipmentMaintenance(companyId, equipmentId);
    return this.findOne(companyId, equipmentId);
  }

  async syncInsuranceExpenses(companyId: number, equipmentId: number) {
    await this.findOne(companyId, equipmentId);
    const existing = await this.profileRepo.findOne({ where: { equipmentId } });
    if (existing) {
      await this.insuranceExpenseSync.ensureAllInsuranceInstallments({
        companyId,
                relatedEquipmentId: equipmentId,
        profile: existing as any,
      });
    }
    return this.findOne(companyId, equipmentId);
  }

  private async assertHitchSlotAvailable(
    companyId: number,
    unitId: number,
    hitchPosition: 'lead' | 'rear' | null,
    excludeEquipmentId?: number,
  ): Promise<void> {
    const others = await this.repo.find({
      where: { companyId, unitId },
      select: ['id', 'unitId', 'hitchPosition'],
    });
    assertEquipmentHitchAssignmentAllowed({
      unitId,
      hitchPosition,
      isSecondTrailer: hitchPosition === 'rear',
      othersOnUnit: others,
      excludeEquipmentId,
    });
  }

  private async resolveUnitId(
    companyId: number,
    ref: string,
  ): Promise<number | undefined> {
    const unitId = parseOptionalNumericId(ref, 'Unit');
    if (!unitId) {
      return undefined;
    }
    const row = await this.unitsRepo.findOne({
      where: { companyId, id: unitId },
      select: ['id', 'isActive', 'transportType'],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    assertFleetResourceActive(row.isActive, 'Unit');
    assertUnitCanHitchEquipment(row.transportType);
    return row.id;
  }

  private async saveFleetMeta(
    companyId: number,
    equipmentId: number,
    fleetMeta: NonNullable<CreateEquipmentDto['fleetMeta']>,
  ): Promise<void> {
    const existing = await this.profileRepo.findOne({ where: { equipmentId } });
    const mapped = fleetMetaDtoToProfile(equipmentId, fleetMeta);
    const profileRow: Partial<EquipmentFleetProfile> = { equipmentId };
    for (const [key, value] of Object.entries(mapped)) {
      if (key !== 'equipmentId' && value !== undefined) {
        (profileRow as Record<string, unknown>)[key] = value;
      }
    }
    await this.profileRepo.save(
      this.profileRepo.create({
        ...(existing ?? {}),
        ...profileRow,
      }),
    );

    const equipment = await this.repo.findOne({
      where: { id: equipmentId, companyId },
      select: ['id', 'unitId'],
    });

    const previousVerificationEntries = await this.verificationRepo.find({
      where: { equipmentId },
      order: { sortOrder: 'ASC' },
    });
    const previousVerificationMeta = verificationMetaFromEntries(previousVerificationEntries);

    if (
      equipment?.unitId &&
      unitFleetMetaVerificationTouched(previousVerificationMeta, fleetMeta)
    ) {
      const incomingForSync =
        fleetMeta.verificationEntries !== undefined
          ? verificationEntriesToMetaScalars(
              resolveVerificationEntriesFromMeta({
                verificationEntries: fleetMeta.verificationEntries,
              }),
            )
          : fleetMeta;

      await this.verificationExpenseSync.syncForEquipmentVerificationSave({
        companyId,
        unitId: equipment.unitId,
        equipmentId,
        previous: previousVerificationMeta,
        incoming: incomingForSync,
      });
    }

    if (
      fleetMeta.verificationEntries !== undefined ||
      unitFleetMetaVerificationTouched(previousVerificationMeta, fleetMeta)
    ) {
      let resolvedEntries = resolveVerificationEntriesFromMeta(fleetMeta).filter(
        (entry) => entry.scope === 'phys_mech',
      );
      if (fleetMeta.verificationEntries === undefined) {
        resolvedEntries = mergeVerificationHistoryOnScalarSave({
          previous: previousVerificationEntries,
          incomingScalars: fleetMeta,
          scopes: ['phys_mech'],
        });
      }
      await this.verificationRepo.delete({ equipmentId });
      const verificationRows = fleetMetaDtoToVerificationEntries(
        equipmentId,
        resolvedEntries,
      );
      if (verificationRows.length > 0) {
        await this.verificationRepo.save(
          verificationRows.map((row) => this.verificationRepo.create(row)),
        );
      }
    }

    if (unitFleetMetaInsuranceTouched(existing, fleetMeta)) {
      await this.insuranceExpenseSync.ensureAllInsuranceInstallments({
        companyId,
                relatedEquipmentId: equipmentId,
        profile: { ...existing, ...fleetMeta } as any,
      });
    }

    await this.fleetTenureService.upsertFromFleetMeta(
      companyId,
      { equipmentId },
      fleetMeta,
    );

    const tenureConfigProvided =
      fleetMeta.trailerRecurringPaymentAmount !== undefined ||
      fleetMeta.trailerRecurringPaymentCadence !== undefined ||
      fleetMeta.trailerRecurringPaymentDate !== undefined ||
      fleetMeta.trailerRecurringInstallmentCount !== undefined ||
      fleetMeta.trailerTenureBeneficiary !== undefined;
    if (tenureConfigProvided) {
      const tenure = await this.fleetTenureService.findByEquipment(companyId, equipmentId);
      if (tenure) {
        await this.tenureExpenseSync.ensureAllTenureInstallments({
          companyId,
          relatedEquipmentId: equipmentId,
          profile: {
            recurringPaymentAmount: tenure.recurringPaymentAmount,
            recurringPaymentCadence: tenure.recurringPaymentCadence,
            recurringPaymentDate: tenure.recurringPaymentDate,
            recurringLastPaymentDate: tenure.recurringLastPaymentDate,
            recurringInstallmentCount: tenure.recurringInstallmentCount,
            tenureBeneficiary: tenure.tenureBeneficiary,
          },
        });
      }
    }

    if (
      fleetMeta.maintenanceEntries !== undefined ||
      lastMaintenanceScalarsProvided(fleetMeta)
    ) {
      const previous = await this.maintenanceRepo.find({
        where: { equipmentId },
        order: { sortOrder: 'ASC' },
      });
      await this.maintenanceRepo.delete({ equipmentId });
      const maintenanceRows = fleetMetaDtoToMaintenanceEntries(equipmentId, fleetMeta);
      if (maintenanceRows.length > 0) {
        await this.maintenanceRepo.save(
          maintenanceRows.map((row) => this.maintenanceRepo.create(row)),
        );
      }
      await this.maintenanceExpenseSync.syncForMaintenanceSave({
        companyId,
                relatedEquipmentId: equipmentId,
        previous,
        incoming:
          fleetMeta.maintenanceEntries ??
          maintenanceRows.map((row) => ({
            date: row.entryDate,
            type: row.entryType,
            cost: row.cost != null ? Number(row.cost) : undefined,
            notes: row.notes,
          })),
      });
    }

    const hasDocumentPayload =
      fleetMeta.documentMaintenanceNames !== undefined ||
      fleetMeta.documentVerificationNames !== undefined ||
      fleetMeta.documentPolicyNames !== undefined ||
      fleetMeta.documentOwnershipNames !== undefined;
    if (hasDocumentPayload) {
      await this.documentsRepo.delete({ equipmentId });
      const documentRows = fleetMetaDtoToDocuments(equipmentId, fleetMeta);
      if (documentRows.length > 0) {
        await this.documentsRepo.save(
          documentRows.map((row) => this.documentsRepo.create(row)),
        );
      }
    }
  }

  private async ensureEquipmentBrand(
    companyId: number,
    fleetMeta: CreateEquipmentDto['fleetMeta'] | UpdateEquipmentDto['fleetMeta'] | undefined,
  ): Promise<void> {
    const brandName = resolveFleetBrandNameFromPayload(fleetMeta);
    if (!brandName) {
      return;
    }
    const brand = await this.fleetBrandsService.findOrCreateBrand(
      companyId,
      FLEET_BRAND_TYPE_EQUIPMENT,
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
