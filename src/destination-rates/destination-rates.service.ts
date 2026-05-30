import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeDestinationRate } from 'src/common/serializers/destination-rate.serializer';
import { OperationConfigurationsService } from 'src/operation-configurations/operation-configurations.service';
import { CreateDestinationRateDto } from './dto/create-destination-rate.dto';
import { DestinationRatePriceInputDto } from './dto/destination-rate-price-input.dto';
import { UpdateDestinationRateDto } from './dto/update-destination-rate.dto';
import { DestinationRatePrice } from './entities/destination-rate-price.entity';
import { DestinationRate } from './entities/destination-rate.entity';

const RATE_RELATIONS = [
  'prices',
  'prices.operationConfiguration',
] as const;

@Injectable()
export class DestinationRatesService {
  constructor(
    @InjectRepository(DestinationRate)
    private readonly repo: Repository<DestinationRate>,
    @InjectRepository(DestinationRatePrice)
    private readonly pricesRepo: Repository<DestinationRatePrice>,
    private readonly operationConfigurations: OperationConfigurationsService,
  ) {}

  async create(companyId: number, dto: CreateDestinationRateDto) {
    await this.assertUniqueLocality(
      companyId,
      dto.postalCode,
      dto.locality,
    );
    await this.assertUniquePriceConfigs(dto.prices);
    const priceRows = await this.buildPriceEntities(companyId, dto.prices);
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        postalCode: dto.postalCode.trim(),
        cityMunicipality: dto.cityMunicipality.trim(),
        locality: dto.locality.trim(),
        active: dto.active ?? true,
        notes: dto.notes?.trim() || undefined,
        prices: priceRows,
      }),
    );
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: [...RATE_RELATIONS],
      order: { postalCode: 'ASC', locality: 'ASC' },
    });
    return rows.map((row) => serializeDestinationRate(row));
  }

  async findOne(companyId: number, rateId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: rateId },
      relations: [...RATE_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Destination rate ${rateId} not found`);
    }
    return serializeDestinationRate(row);
  }

  async update(
    companyId: number,
    rateId: number,
    dto: UpdateDestinationRateDto,
  ) {
    const existing = await this.repo.findOne({
      where: { companyId, id: rateId },
    });
    if (!existing) {
      throw new NotFoundException(`Destination rate ${rateId} not found`);
    }

    const nextPostal = dto.postalCode?.trim() ?? existing.postalCode;
    const nextLocality = dto.locality?.trim() ?? existing.locality;
    if (
      nextPostal !== existing.postalCode ||
      nextLocality !== existing.locality
    ) {
      await this.assertUniqueLocality(
        companyId,
        nextPostal,
        nextLocality,
        rateId,
      );
    }

    await this.repo.update(
      { id: rateId, companyId },
      {
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode.trim() }),
        ...(dto.cityMunicipality !== undefined && {
          cityMunicipality: dto.cityMunicipality.trim(),
        }),
        ...(dto.locality !== undefined && { locality: dto.locality.trim() }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && {
          notes: dto.notes.trim() || undefined,
        }),
      },
    );

    if (dto.prices) {
      await this.assertUniquePriceConfigs(dto.prices);
      await this.pricesRepo.delete({ destinationRateId: rateId });
      const priceRows = await this.buildPriceEntities(companyId, dto.prices);
      for (const row of priceRows) {
        row.destinationRateId = rateId;
      }
      await this.pricesRepo.save(priceRows);
    }

    return this.findOne(companyId, rateId);
  }

  async remove(companyId: number, rateId: number) {
    await this.findOne(companyId, rateId);
    await this.repo.delete({ id: rateId, companyId });
    return { id: rateId, deleted: true };
  }

  private async buildPriceEntities(
    companyId: number,
    prices: DestinationRatePriceInputDto[],
  ): Promise<DestinationRatePrice[]> {
    const rows: DestinationRatePrice[] = [];
    for (const input of prices) {
      const config = await this.operationConfigurations.resolveForPriceInput(
        companyId,
        input,
      );
      rows.push(
        this.pricesRepo.create({
          operationConfigurationId: config.id,
          clientCharge: String(input.clientCharge),
          operatorPaymentEstimate: String(input.operatorPaymentEstimate),
          estimatedTollAmount: String(input.estimatedTollAmount ?? 0),
          notes: input.notes?.trim() || undefined,
        }),
      );
    }
    return rows;
  }

  private async assertUniquePriceConfigs(
    prices: DestinationRatePriceInputDto[],
  ): Promise<void> {
    const keys = new Set<string>();
    for (const price of prices) {
      const key =
        price.operationConfigurationId?.trim() ||
        price.operationConfigurationName?.trim().toLowerCase() ||
        '';
      if (!key) {
        throw new ConflictException(
          'Cada tarifa debe indicar tipo de maniobra',
        );
      }
      if (keys.has(key)) {
        throw new ConflictException(
          'No repitas el mismo tipo de maniobra en una tarifa',
        );
      }
      keys.add(key);
    }
  }

  private async assertUniqueLocality(
    companyId: number,
    postalCode: string,
    locality: string,
    excludeId?: number,
  ): Promise<void> {
    const row = await this.repo.findOne({
      where: {
        companyId,
        postalCode: postalCode.trim(),
        locality: locality.trim(),
      },
    });
    if (row && row.id !== excludeId) {
      throw new ConflictException(
        'Ya existe una tarifa para este CP y localidad',
      );
    }
  }
}
