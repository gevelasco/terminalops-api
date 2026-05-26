import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeEquipment } from 'src/common/serializers/equipment.serializer';
import { ResourcePublicIdService } from 'src/common/tenant/resource-public-id.service';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly repo: Repository<Equipment>,
    private readonly publicIds: ResourcePublicIdService,
  ) {}

  async create(
    companyId: string,
    companyPublicId: number,
    dto: CreateEquipmentDto,
  ) {
    const unitId = dto.unitId
      ? await this.publicIds.resolveUnitRef(companyId, dto.unitId)
      : undefined;
    const saved = await this.repo.save(
      this.repo.create({ ...dto, companyId, unitId }),
    );
    return this.findOne(companyId, saved.publicId, companyPublicId);
  }

  async findAll(companyId: string, companyPublicId: number) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: ['unit', 'fleetProfile'],
      order: { name: 'ASC' },
    });
    return rows.map((row) =>
      serializeEquipment(row, companyPublicId, row.unit?.publicId),
    );
  }

  async findOne(
    companyId: string,
    equipmentPublicId: number,
    companyPublicId: number,
  ) {
    const row = await this.repo.findOne({
      where: { companyId, publicId: equipmentPublicId },
      relations: ['unit', 'fleetProfile'],
    });
    if (!row) {
      throw new NotFoundException(`Equipment ${equipmentPublicId} not found`);
    }
    return serializeEquipment(row, companyPublicId, row.unit?.publicId);
  }

  async update(
    companyId: string,
    equipmentPublicId: number,
    companyPublicId: number,
    dto: UpdateEquipmentDto,
  ) {
    const internalId = await this.publicIds.resolveEquipmentInternalId(
      companyId,
      equipmentPublicId,
    );
    const { unitId: unitIdRef, ...rest } = dto;
    const unitId =
      unitIdRef !== undefined
        ? await this.publicIds.resolveUnitRef(companyId, unitIdRef)
        : undefined;
    await this.repo.update(
      { id: internalId, companyId },
      {
        ...rest,
        ...(unitIdRef !== undefined ? { unitId } : {}),
      },
    );
    return this.findOne(companyId, equipmentPublicId, companyPublicId);
  }

  async remove(companyId: string, equipmentPublicId: number) {
    const internalId = await this.publicIds.resolveEquipmentInternalId(
      companyId,
      equipmentPublicId,
    );
    await this.repo.delete({ id: internalId, companyId });
    return { id: equipmentPublicId, deleted: true };
  }
}
