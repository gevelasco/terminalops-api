import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeUnit } from 'src/common/serializers/unit.serializer';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
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

const UNIT_RELATIONS = [
  'fleetProfile',
  'maintenanceEntries',
  'fleetDocuments',
  'equipment',
] as const;

export type UnitsFindAllOptions = { includeTenure?: boolean };

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
  ) {}

  async create(companyId: number, dto: CreateUnitDto) {
    const { fleetMeta, ...core } = dto;
    const saved = await this.repo.save(this.repo.create({ ...core, companyId }));
    if (fleetMeta) {
      await this.saveFleetMeta(companyId, saved.id, fleetMeta);
    }
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number, options?: UnitsFindAllOptions) {
    const rows = await this.repo.find({
      where: { companyId },
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

  async update(companyId: number, unitId: number, dto: UpdateUnitDto) {
    await this.findOne(companyId, unitId);
    const { fleetMeta, ...core } = dto;
    if (Object.keys(core).length > 0) {
      await this.repo.update({ id: unitId, companyId }, core);
    }
    if (fleetMeta !== undefined) {
      await this.saveFleetMeta(companyId, unitId, fleetMeta);
    }
    return this.findOne(companyId, unitId);
  }

  async remove(companyId: number, unitId: number) {
    await this.findOne(companyId, unitId);
    await this.repo.delete({ id: unitId, companyId });
    return { id: unitId, deleted: true };
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

    await this.fleetTenureService.upsertFromFleetMeta(companyId, { unitId }, fleetMeta);

    if (fleetMeta.maintenanceEntries !== undefined) {
      await this.maintenanceRepo.delete({ unitId });
      const maintenanceRows = fleetMetaDtoToMaintenanceEntries(unitId, fleetMeta);
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
      await this.documentsRepo.delete({ unitId });
      const documentRows = fleetMetaDtoToDocuments(unitId, fleetMeta);
      if (documentRows.length > 0) {
        await this.documentsRepo.save(
          documentRows.map((row) => this.documentsRepo.create(row)),
        );
      }
    }
  }
}
