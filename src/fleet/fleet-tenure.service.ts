import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import {
  fleetMetaDtoHasTenureFields,
  fleetMetaDtoToTenureRow,
  fleetTenureMapKey,
  type FleetAssetTenureUpsert,
  type FleetMetaTenureFields,
} from 'src/fleet/mappers/fleet-asset-tenure.mapper';

@Injectable()
export class FleetTenureService {
  constructor(
    @InjectRepository(FleetAssetTenure)
    private readonly repo: Repository<FleetAssetTenure>,
  ) {}

  async findByUnit(companyId: number, unitId: number): Promise<FleetAssetTenure | null> {
    return this.repo.findOne({ where: { companyId, unitId } });
  }

  async findByEquipment(
    companyId: number,
    equipmentId: number,
  ): Promise<FleetAssetTenure | null> {
    return this.repo.findOne({ where: { companyId, equipmentId } });
  }

  async findAllForCompany(companyId: number): Promise<FleetAssetTenure[]> {
    return this.repo.find({ where: { companyId } });
  }

  buildLookupMap(rows: FleetAssetTenure[]): Map<string, FleetAssetTenure> {
    const map = new Map<string, FleetAssetTenure>();
    for (const row of rows) {
      if (row.unitId != null) {
        map.set(fleetTenureMapKey({ unitId: row.unitId }), row);
      } else if (row.equipmentId != null) {
        map.set(fleetTenureMapKey({ equipmentId: row.equipmentId }), row);
      }
    }
    return map;
  }

  async upsertFromFleetMeta(
    companyId: number,
    subject: { unitId: number } | { equipmentId: number },
    meta: FleetMetaTenureFields,
  ): Promise<void> {
    if (!fleetMetaDtoHasTenureFields(meta)) {
      return;
    }
    const where =
      'unitId' in subject
        ? { companyId, unitId: subject.unitId }
        : { companyId, equipmentId: subject.equipmentId };
    const existing = await this.repo.findOne({ where });
    const patch: FleetAssetTenureUpsert = fleetMetaDtoToTenureRow(companyId, subject, meta);
    await this.repo.save({
      ...(existing ?? {}),
      ...patch,
      id: existing?.id,
    } as FleetAssetTenure);
  }
}
