import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  normalizeOperationConfigCode,
  normalizeOperationConfigName,
} from 'src/common/utils/operation-config-code.util';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { serializeOperationConfiguration } from 'src/common/serializers/operation-configuration.serializer';
import { CreateOperationConfigurationDto } from './dto/create-operation-configuration.dto';
import { UpdateOperationConfigurationDto } from './dto/update-operation-configuration.dto';
import { CompanyOperationConfiguration } from './entities/company-operation-configuration.entity';

@Injectable()
export class OperationConfigurationsService {
  constructor(
    @InjectRepository(CompanyOperationConfiguration)
    private readonly repo: Repository<CompanyOperationConfiguration>,
  ) {}

  async findByCode(companyId: number, code: string) {
    const normalized = code.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    const row = await this.repo.findOne({
      where: { companyId, code: normalized },
    });
    return row ?? null;
  }

  async findAll(companyId: number) {
    const rows = await this.repo.find({
      where: { companyId },
      order: { name: 'ASC' },
    });
    return rows.map((row) => serializeOperationConfiguration(row));
  }

  async findOne(companyId: number, configId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: configId },
    });
    if (!row) {
      throw new NotFoundException(
        `Operation configuration ${configId} not found`,
      );
    }
    return serializeOperationConfiguration(row);
  }

  async create(companyId: number, dto: CreateOperationConfigurationDto) {
    const name = normalizeOperationConfigName(dto.name);
    if (!name) {
      throw new ConflictException('El nombre de la configuración es obligatorio');
    }
    const code = normalizeOperationConfigCode(dto.code?.trim() || name);
    if (!code) {
      throw new ConflictException('No se pudo generar un código válido');
    }
    await this.assertUnique(companyId, code, name);
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        code,
        name,
        maxEquipmentCount: dto.maxEquipmentCount ?? 1,
        active: dto.active ?? true,
        version: 1,
      }),
    );
    return this.findOne(companyId, saved.id);
  }

  async update(
    companyId: number,
    configId: number,
    dto: UpdateOperationConfigurationDto,
  ) {
    const existing = await this.repo.findOne({
      where: { companyId, id: configId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Operation configuration ${configId} not found`,
      );
    }
    const nextName =
      dto.name !== undefined
        ? normalizeOperationConfigName(dto.name)
        : existing.name;
    const nextCode =
      dto.code !== undefined
        ? normalizeOperationConfigCode(dto.code)
        : dto.name !== undefined
          ? normalizeOperationConfigCode(dto.name)
          : existing.code;
    if (!nextName || !nextCode) {
      throw new ConflictException('Nombre o código inválido');
    }
    if (nextName !== existing.name || nextCode !== existing.code) {
      await this.assertUnique(companyId, nextCode, nextName, configId);
    }
    const nextMaxEquipment =
      dto.maxEquipmentCount !== undefined
        ? dto.maxEquipmentCount
        : existing.maxEquipmentCount;
    const nextActive =
      dto.active !== undefined ? dto.active : existing.active;
    const structuralChange =
      nextName !== existing.name ||
      nextCode !== existing.code ||
      nextMaxEquipment !== existing.maxEquipmentCount ||
      nextActive !== existing.active;
    await this.repo.update(
      { id: configId, companyId },
      {
        ...(dto.name !== undefined && { name: nextName, code: nextCode }),
        ...(dto.code !== undefined && dto.name === undefined && { code: nextCode }),
        ...(dto.maxEquipmentCount !== undefined && {
          maxEquipmentCount: dto.maxEquipmentCount,
        }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(structuralChange && { version: existing.version + 1 }),
      },
    );
    return this.findOne(companyId, configId);
  }

  async remove(companyId: number, configId: number) {
    await this.findOne(companyId, configId);
    await this.repo.delete({ id: configId, companyId });
    return { id: configId, deleted: true };
  }

  async resolveForPriceInput(
    companyId: number,
    input: {
      operationConfigurationId?: string;
      operationConfigurationName?: string;
    },
  ): Promise<CompanyOperationConfiguration> {
    if (input.operationConfigurationId) {
      const configId = parseOptionalNumericId(
        input.operationConfigurationId,
        'Operation configuration',
      )!;
      const row = await this.repo.findOne({
        where: { companyId, id: configId },
      });
      if (!row) {
        throw new NotFoundException(
          `Operation configuration ${configId} not found`,
        );
      }
      return row;
    }
    const name = normalizeOperationConfigName(
      input.operationConfigurationName ?? '',
    );
    if (!name) {
      throw new ConflictException(
        'Indica el tipo de maniobra para cada tarifa',
      );
    }
    return this.findOrCreateByName(companyId, name);
  }

  async findOrCreateByName(
    companyId: number,
    rawName: string,
  ): Promise<CompanyOperationConfiguration> {
    const name = normalizeOperationConfigName(rawName);
    const code = normalizeOperationConfigCode(name);
    const existingByCode = await this.repo.findOne({
      where: { companyId, code },
    });
    if (existingByCode) {
      return existingByCode;
    }
    const existingByName = await this.repo
      .createQueryBuilder('cfg')
      .where('cfg.company_id = :companyId', { companyId })
      .andWhere('lower(trim(cfg.name)) = lower(trim(:name))', { name })
      .getOne();
    if (existingByName) {
      return existingByName;
    }
    return this.repo.save(
      this.repo.create({
        companyId,
        code,
        name,
        maxEquipmentCount: 1,
        active: true,
        version: 1,
      }),
    );
  }

  private async assertUnique(
    companyId: number,
    code: string,
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const byCode = await this.repo.findOne({ where: { companyId, code } });
    if (byCode && byCode.id !== excludeId) {
      throw new ConflictException(
        'Ya existe una configuración operacional con ese código',
      );
    }
    const byName = await this.repo
      .createQueryBuilder('cfg')
      .where('cfg.company_id = :companyId', { companyId })
      .andWhere('lower(trim(cfg.name)) = lower(trim(:name))', { name })
      .getOne();
    if (byName && byName.id !== excludeId) {
      throw new ConflictException(
        'Ya existe una configuración operacional con ese nombre',
      );
    }
  }
}
