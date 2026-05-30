import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeEquipment } from 'src/common/serializers/equipment.serializer';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
import { fleetTenureMapKey } from 'src/fleet/mappers/fleet-asset-tenure.mapper';
import { EquipmentFleetDocument } from 'src/equipment/entities/equipment-fleet-document.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import {
  fleetMetaDtoToDocuments,
  fleetMetaDtoToMaintenanceEntries,
  fleetMetaDtoToProfile,
} from './mappers/equipment-fleet-meta.mapper';
import { assertEquipmentHitchAssignmentAllowed } from './equipment-hitch-validation.util';

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
    @InjectRepository(EquipmentFleetDocument)
    private readonly documentsRepo: Repository<EquipmentFleetDocument>,
    private readonly fleetTenureService: FleetTenureService,
  ) {}

  async create(companyId: number, dto: CreateEquipmentDto) {
    const { fleetMeta, unitId: unitIdRef, hitchPosition, ...core } = dto;
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
      }),
    );
    if (fleetMeta) {
      await this.saveFleetMeta(companyId, saved.id, fleetMeta);
    }
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number, options?: EquipmentFindAllOptions) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: ['unit', 'fleetProfile', 'maintenanceEntries', 'fleetDocuments'],
      order: { name: 'ASC' },
    });
    const tenureByKey = options?.includeTenure
      ? this.fleetTenureService.buildLookupMap(
          await this.fleetTenureService.findAllForCompany(companyId),
        )
      : null;
    return rows.map((row) =>
      serializeEquipment(row, {
        tenure: tenureByKey?.get(fleetTenureMapKey({ equipmentId: row.id })),
      }),
    );
  }

  async findOne(companyId: number, equipmentId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: equipmentId },
      relations: ['unit', 'fleetProfile', 'maintenanceEntries', 'fleetDocuments'],
    });
    if (!row) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    const tenure = await this.fleetTenureService.findByEquipment(companyId, equipmentId);
    return serializeEquipment(row, { tenure });
  }

  async update(companyId: number, equipmentId: number, dto: UpdateEquipmentDto) {
    const current = await this.repo.findOne({
      where: { companyId, id: equipmentId },
    });
    if (!current) {
      throw new NotFoundException(`Equipment ${equipmentId} not found`);
    }
    const { unitId: unitIdRef, fleetMeta, hitchPosition, ...rest } = dto;
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
    if (Object.keys(corePatch).length > 0) {
      await this.repo.update({ id: equipmentId, companyId }, corePatch);
    }
    if (fleetMeta !== undefined) {
      await this.saveFleetMeta(companyId, equipmentId, fleetMeta);
    }
    return this.findOne(companyId, equipmentId);
  }

  async remove(companyId: number, equipmentId: number) {
    await this.findOne(companyId, equipmentId);
    await this.repo.delete({ id: equipmentId, companyId });
    return { id: equipmentId, deleted: true };
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
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
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

    await this.fleetTenureService.upsertFromFleetMeta(
      companyId,
      { equipmentId },
      fleetMeta,
    );

    if (fleetMeta.maintenanceEntries !== undefined) {
      await this.maintenanceRepo.delete({ equipmentId });
      const maintenanceRows = fleetMetaDtoToMaintenanceEntries(equipmentId, fleetMeta);
      if (maintenanceRows.length > 0) {
        await this.maintenanceRepo.save(
          maintenanceRows.map((row) => this.maintenanceRepo.create(row)),
        );
      }
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
}
