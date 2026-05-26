import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeUnit } from 'src/common/serializers/unit.serializer';
import { ResourcePublicIdService } from 'src/common/tenant/resource-public-id.service';
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
    private readonly publicIds: ResourcePublicIdService,
  ) {}

  async create(companyId: string, companyPublicId: number, dto: CreateUnitDto) {
    const { fleetMeta, ...core } = dto;
    const saved = await this.repo.save(this.repo.create({ ...core, companyId }));
    if (fleetMeta) {
      await this.saveFleetMeta(saved.id, fleetMeta);
    }
    return this.findOne(companyId, saved.publicId, companyPublicId);
  }

  async findAll(companyId: string, companyPublicId: number) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: [...UNIT_RELATIONS],
      order: { plate: 'ASC' },
    });
    return rows.map((row) => serializeUnit(row, companyPublicId));
  }

  async findOne(
    companyId: string,
    unitPublicId: number,
    companyPublicId: number,
  ) {
    const row = await this.repo.findOne({
      where: { companyId, publicId: unitPublicId },
      relations: [...UNIT_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${unitPublicId} not found`);
    }
    return serializeUnit(row, companyPublicId);
  }

  async update(
    companyId: string,
    unitPublicId: number,
    companyPublicId: number,
    dto: UpdateUnitDto,
  ) {
    const internalId = await this.publicIds.resolveUnitInternalId(
      companyId,
      unitPublicId,
    );
    const { fleetMeta, ...core } = dto;
    if (Object.keys(core).length > 0) {
      await this.repo.update({ id: internalId, companyId }, core);
    }
    if (fleetMeta !== undefined) {
      await this.saveFleetMeta(internalId, fleetMeta);
    }
    return this.findOne(companyId, unitPublicId, companyPublicId);
  }

  async remove(companyId: string, unitPublicId: number) {
    const internalId = await this.publicIds.resolveUnitInternalId(
      companyId,
      unitPublicId,
    );
    await this.repo.delete({ id: internalId, companyId });
    return { id: unitPublicId, deleted: true };
  }

  private async saveFleetMeta(
    unitId: string,
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
