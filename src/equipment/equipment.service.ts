import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type ObjectLiteral, type SelectQueryBuilder } from 'typeorm';
import { FileService } from 'src/common/file/file.service';
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
import {
  FLEET_ASSIGNABLE_LIST_STATUS,
  type FleetListAvailableOptions,
} from 'src/fleet/fleet-available-list.util';
import {
  applyEquipmentNotOnActiveTripFilter,
  fleetListSchema,
} from 'src/fleet/fleet-assignable-list.filter';
import {
  loadLatestMaintenanceByOwnerIds,
  loadLatestVerificationByOwnerIds,
} from 'src/fleet/fleet-latest-entries.loader';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import {
  EQUIPMENT_FLEET_DOCUMENT_KINDS,
  EQUIPMENT_FLEET_DOCUMENT_STORAGE_FOLDER,
  type EquipmentFleetDocumentKind,
} from './equipment-fleet-document.constants';
import {
  fleetMetaDtoToMaintenanceEntries,
  fleetMetaDtoToProfile,
  fleetMetaDtoToVerificationEntries,
  lastMaintenanceScalarsProvided,
  verificationMetaFromEntries,
} from './mappers/equipment-fleet-meta.mapper';
import {
  mergeVerificationHistoryOnScalarSave,
  normalizeClearedVerificationScopes,
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
import { fleetPatchActivity } from 'src/activity-events/activity-events.fleet.util';
import { buildEquipmentOperationalId } from 'src/common/utils/unit-operational-id.util';
import type AuthUser from 'src/types/auth-user.type';
import {
  ListResourcePageQueryDto,
  normalizeResourceListLimit,
  normalizeResourceListPage,
  toResourceListResult,
  type ResourceListResult,
} from 'src/common/dto/list-resource-page-query.dto';

export type EquipmentFindAllOptions = FleetListAvailableOptions &
  ListResourcePageQueryDto & {
    includeTenure?: boolean;
  };

export type EquipmentListResult = ResourceListResult<
  ReturnType<typeof serializeEquipment>
>;

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

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
    private readonly fileService: FileService,
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
    } else {
      await this.verificationExpenseSync.ensureExemptionVerificationExpenses({
        companyId,
        relatedUnitId: saved.unitId ?? undefined,
        relatedEquipmentId: saved.id,
        trailerYear: saved.trailerYear,
        previous: {},
        scopes: ['phys_mech'],
      });
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

  async findAll(
    companyId: number,
    options?: EquipmentFindAllOptions,
  ): Promise<EquipmentListResult> {
    const limit = normalizeResourceListLimit(options?.limit);
    const page = normalizeResourceListPage(options?.page);
    const schema = fleetListSchema(this.repo.metadata.schema);

    const applyScope = <T extends ObjectLiteral>(
      qb: SelectQueryBuilder<T>,
    ): SelectQueryBuilder<T> => {
      qb.where('equipment.companyId = :companyId', { companyId }).andWhere(
        'equipment.isActive = :isActive',
        { isActive: true },
      );
      if (!options?.available) {
        return qb;
      }
      qb.andWhere('equipment.status = :assignableStatus', {
        assignableStatus: FLEET_ASSIGNABLE_LIST_STATUS,
      });
      applyEquipmentNotOnActiveTripFilter(qb, schema, 'equipment');
      return qb;
    };

    const total = await applyScope(
      this.repo.createQueryBuilder('equipment'),
    ).getCount();

    const dataQb = applyScope(
      this.repo
        .createQueryBuilder('equipment')
        .leftJoinAndSelect('equipment.fleetProfile', 'fleetProfile'),
    ).orderBy('equipment.name', 'ASC');
    if (limit > 0) {
      dataQb.skip((page - 1) * limit).take(limit);
    }
    const rows = await dataQb.getMany();
    const equipmentIds = rows.map((row) => row.id);
    const [maint, verif] = await Promise.all([
      loadLatestMaintenanceByOwnerIds(
        this.repo.manager,
        schema,
        'equipment_id',
        equipmentIds,
      ),
      loadLatestVerificationByOwnerIds(
        this.repo.manager,
        schema,
        'equipment_id',
        equipmentIds,
      ),
    ]);
    for (const row of rows) {
      row.maintenanceEntries = maint.get(row.id) ?? [];
      row.verificationEntries = verif.get(row.id) ?? [];
    }
    return toResourceListResult(
      rows.map((row) => serializeEquipment(row, { list: true })),
      total,
      page,
      limit,
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
      .andWhere('equipment.isActive = :isActive', { isActive: true })
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
      relations: [
        'unit',
        'unit.fleetProfile',
        'fleetProfile',
        'maintenanceEntries',
        'verificationEntries',
        'fleetDocuments',
      ],
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
      const patchActivity = fleetPatchActivity('equipment', fleetMeta);
      await this.activityEvents.record({
        companyId,
        kind: patchActivity.kind,
        entityType: 'equipment',
        entityId: equipmentId,
        subjectLabel: buildEquipmentOperationalId(row),
        title: patchActivity.title,
        actor,
      });
    }
    return this.findOne(companyId, equipmentId);
  }

  /** Soft delete lógico: oculta de flota/asignaciones y conserva historial en maniobras. */
  async remove(companyId: number, equipmentId: number) {
    const row = await this.assertEquipmentExists(companyId, equipmentId);
    if (row.isActive === false) {
      return { id: equipmentId, deleted: true };
    }
    await this.repo.update({ id: equipmentId, companyId }, { isActive: false });
    return { id: equipmentId, deleted: true };
  }

  async uploadDocument(
    companyId: number,
    equipmentId: number,
    documentKind: EquipmentFleetDocumentKind,
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (
      !(EQUIPMENT_FLEET_DOCUMENT_KINDS as readonly string[]).includes(
        documentKind,
      )
    ) {
      throw new BadRequestException('Invalid documentKind');
    }
    await this.assertEquipmentExists(companyId, equipmentId);

    const uploaded = await this.fileService.upload(
      EQUIPMENT_FLEET_DOCUMENT_STORAGE_FOLDER,
      file,
    );
    const maxSort = await this.documentsRepo
      .createQueryBuilder('d')
      .select('MAX(d.sort_order)', 'max')
      .where('d.equipment_id = :equipmentId', { equipmentId })
      .getRawOne<{ max: string | null }>();
    const sortOrder = Number(maxSort?.max ?? -1) + 1;

    const saved = await this.documentsRepo.save(
      this.documentsRepo.create({
        equipmentId,
        documentKind,
        fileName: uploaded.originalName,
        storageKey: uploaded.url,
        contentType: file.mimetype || null,
        sizeBytes: String(file.size),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      }),
    );

    return {
      id: saved.id,
      equipmentId: saved.equipmentId,
      documentKind: saved.documentKind,
      fileName: saved.fileName,
      sortOrder: saved.sortOrder,
    };
  }

  async downloadDocument(
    companyId: number,
    equipmentId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForEquipment(
      companyId,
      equipmentId,
      documentId,
    );
    if (!document.storageKey) {
      throw new NotFoundException(
        `Document ${documentId} has no stored file`,
      );
    }
    return this.fileService.presignedUrl(document.storageKey);
  }

  async removeDocument(
    companyId: number,
    equipmentId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForEquipment(
      companyId,
      equipmentId,
      documentId,
    );
    if (document.storageKey) {
      await this.fileService.remove(document.storageKey);
    }
    await this.documentsRepo.delete({ id: documentId, equipmentId });
    return { id: documentId, deleted: true };
  }

  private async findDocumentForEquipment(
    companyId: number,
    equipmentId: number,
    documentId: number,
  ): Promise<EquipmentFleetDocument> {
    await this.assertEquipmentExists(companyId, equipmentId);
    const document = await this.documentsRepo.findOne({
      where: { id: documentId, equipmentId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return document;
  }

  /** Existence/tenant check without loading fleetDocuments (avoids schema-drift 500s). */
  private async assertEquipmentExists(
    companyId: number,
    equipmentId: number,
  ): Promise<Equipment> {
    const row = await this.repo.findOne({
      where: { companyId, id: equipmentId },
    });
    if (!row) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    return row;
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
    const equipment = await this.repo.findOne({
      where: { id: equipmentId, companyId },
      select: ['id', 'unitId', 'trailerYear'],
    });

    const previousVerificationEntries = await this.verificationRepo.find({
      where: { equipmentId },
      order: { sortOrder: 'ASC' },
    });
    const previousVerificationMeta = verificationMetaFromEntries(previousVerificationEntries);
    const equipmentVerificationScopes = [
      'phys_mech',
      'double_articulated',
    ] as const;
    const clearedVerificationScopes = normalizeClearedVerificationScopes(
      fleetMeta.clearedVerificationScopes,
      [...equipmentVerificationScopes],
    );

    await this.profileRepo.save(
      this.profileRepo.create({
        ...(existing ?? {}),
        ...profileRow,
      }),
    );

    for (const scope of clearedVerificationScopes) {
      const lastYmd =
        scope === 'phys_mech'
          ? previousVerificationMeta.verificationPhysMechDate
          : previousVerificationMeta.verificationDoubleArticulatedDate;
      await this.verificationExpenseSync.clearVerificationScope({
        companyId,
        relatedUnitId: equipment?.unitId ?? undefined,
        relatedEquipmentId: equipmentId,
        scope,
        lastVerificationYmd:
          typeof lastYmd === 'string' ? lastYmd : undefined,
      });
    }

    if (unitFleetMetaVerificationTouched(previousVerificationMeta, fleetMeta)) {
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
        unitId: equipment?.unitId ?? undefined,
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
        (entry) =>
          (equipmentVerificationScopes as readonly string[]).includes(
            entry.scope ?? '',
          ),
      );
      if (fleetMeta.verificationEntries === undefined) {
        resolvedEntries = mergeVerificationHistoryOnScalarSave({
          previous: previousVerificationEntries,
          incomingScalars: fleetMeta,
          scopes: [...equipmentVerificationScopes],
          clearedScopes: clearedVerificationScopes,
        });
      } else if (clearedVerificationScopes.length > 0) {
        const cleared = new Set(clearedVerificationScopes);
        resolvedEntries = resolvedEntries.filter(
          (entry) => !cleared.has(entry.scope as (typeof clearedVerificationScopes)[number]),
        );
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

    await this.verificationExpenseSync.ensureExemptionVerificationExpenses({
      companyId,
      relatedUnitId: equipment?.unitId ?? undefined,
      relatedEquipmentId: equipmentId,
      trailerYear: equipment?.trailerYear,
      previous: verificationMetaFromEntries(
        await this.verificationRepo.find({
          where: { equipmentId },
          order: { sortOrder: 'ASC' },
        }),
      ),
      scopes: ['phys_mech'],
    });

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

    // Document files are managed via POST/DELETE /equipment/:equipmentId/documents.
    // Ignoring legacy document*Names arrays avoids wiping stored S3 objects.
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
