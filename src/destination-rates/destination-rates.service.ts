import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeDestinationRate } from 'src/common/serializers/destination-rate.serializer';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { OperationalCentersService } from 'src/operational-centers/operational-centers.service';
import { OperationConfigurationsService } from 'src/operation-configurations/operation-configurations.service';
import { resolveTripOperationalDistance } from 'src/trips/trip-operational-distance.util';
import { CreateDestinationRateDto } from './dto/create-destination-rate.dto';
import { DestinationRatePriceInputDto } from './dto/destination-rate-price-input.dto';
import { UpdateDestinationRateDto } from './dto/update-destination-rate.dto';
import { ClientDelivery } from '../clients/entities/client-delivery.entity';
import { DestinationRatePrice } from './entities/destination-rate-price.entity';
import { DestinationRate } from './entities/destination-rate.entity';

const RATE_RELATIONS = [
  'prices',
  'prices.operationConfiguration',
  'originOperationalCenter',
] as const;

@Injectable()
export class DestinationRatesService {
  constructor(
    @InjectRepository(DestinationRate)
    private readonly repo: Repository<DestinationRate>,
    @InjectRepository(DestinationRatePrice)
    private readonly pricesRepo: Repository<DestinationRatePrice>,
    @InjectRepository(ClientDelivery)
    private readonly clientDeliveryRepo: Repository<ClientDelivery>,
    private readonly operationConfigurations: OperationConfigurationsService,
    private readonly operationalCenters: OperationalCentersService,
  ) {}

  async create(companyId: number, dto: CreateDestinationRateDto) {
    const originCenterId = parseOptionalNumericId(dto.originOperationalCenterId);
    if (originCenterId == null) {
      throw new NotFoundException('Centro operativo de origen inválido');
    }
    const originCenter = await this.operationalCenters.resolveCenterId(
      companyId,
      originCenterId,
    );
    const destPostal = dto.postalCode.trim();
    const destLocality = dto.locality.trim();
    await this.assertUniqueRoute(
      companyId,
      originCenter.id,
      destPostal,
      destLocality,
    );
    await this.assertUniquePriceConfigs(dto.prices);
    const priceRows = await this.buildPriceEntities(companyId, dto.prices);
    const distanceFields = this.resolveDistanceFieldsForPersist(
      dto.routeDistanceKm,
      dto.isRoundTrip !== false,
    );
    const estimatedTimeFields = this.resolveEstimatedTimeFieldsForPersist(dto);
    const originSnapshot = this.operationalCenters.snapshotFromCenter(originCenter);
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        originOperationalCenterId: originCenter.id,
        originPostalCode: originSnapshot.originPostalCode,
        originCityMunicipality: originSnapshot.originCityMunicipality,
        originLocality: originSnapshot.originLocality,
        originLatitude: originSnapshot.originLatitude,
        originLongitude: originSnapshot.originLongitude,
        postalCode: destPostal,
        cityMunicipality: dto.cityMunicipality.trim(),
        locality: destLocality,
        destinationLatitude:
          dto.destinationLatitude != null
            ? String(dto.destinationLatitude)
            : undefined,
        destinationLongitude:
          dto.destinationLongitude != null
            ? String(dto.destinationLongitude)
            : undefined,
        routeDistanceKm: distanceFields?.routeDistanceKm,
        operationalDistanceKm: distanceFields?.operationalDistanceKm,
        isRoundTrip: dto.isRoundTrip !== false,
        distanceCalculatedAt: distanceFields ? new Date() : undefined,
        ...estimatedTimeFields,
        active: dto.active ?? true,
        notes: dto.notes?.trim() || undefined,
        prices: priceRows,
      }),
    );
    await this.linkClientsWithMatchingDelivery(companyId, saved);
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number) {
    const rows = await this.repo
      .createQueryBuilder('rate')
      .leftJoinAndSelect('rate.prices', 'prices')
      .leftJoinAndSelect('prices.operationConfiguration', 'operationConfiguration')
      .leftJoinAndSelect('rate.originOperationalCenter', 'originOperationalCenter')
      .loadRelationCountAndMap('rate.maneuverCount', 'rate.trips', 'trip')
      .where('rate.companyId = :companyId', { companyId })
      .orderBy('rate.postalCode', 'ASC')
      .addOrderBy('rate.locality', 'ASC')
      .getMany();
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

  async getRateEntity(
    companyId: number,
    rateId: number,
  ): Promise<DestinationRate | null> {
    return this.repo.findOne({
      where: { companyId, id: rateId },
      relations: [...RATE_RELATIONS],
    });
  }

  async findMatchingRate(
    companyId: number,
    params: {
      originOperationalCenterId: number;
      destinationPostalCode: string;
      destinationLocality: string;
      activeOnly?: boolean;
    },
  ): Promise<DestinationRate | null> {
    const where: Record<string, unknown> = {
      companyId,
      originOperationalCenterId: params.originOperationalCenterId,
      postalCode: this.normalizeRouteDestinationPostalCode(
        params.destinationPostalCode,
      ),
      locality: this.normalizeRouteDestinationLocality(
        params.destinationLocality,
      ),
    };
    if (params.activeOnly !== false) {
      where.active = true;
    }
    return this.repo.findOne({
      where,
      relations: [...RATE_RELATIONS],
    });
  }

  async checkRouteExists(
    companyId: number,
    params: {
      originOperationalCenterId: string;
      postalCode: string;
      locality: string;
    },
  ): Promise<{ exists: boolean; destinationRateId?: number }> {
    const originCenterId = parseOptionalNumericId(params.originOperationalCenterId);
    if (originCenterId == null) {
      return { exists: false };
    }
    await this.operationalCenters.resolveCenterId(companyId, originCenterId);
    const row = await this.findRateByUniqueRoute(
      companyId,
      originCenterId,
      params.postalCode,
      params.locality,
    );
    if (!row) {
      return { exists: false };
    }
    return { exists: true, destinationRateId: row.id };
  }

  /**
   * Resuelve tarifa para datos de entrega del cliente (misma lógica que check-exists).
   * Usa centro operativo por defecto si no se indica origen.
   */
  async findRateForClientDelivery(
    companyId: number,
    params: {
      postalCode?: string;
      locality?: string;
      originOperationalCenterId?: number;
    },
  ): Promise<DestinationRate | null> {
    const postalCode = params.postalCode?.trim();
    const locality = params.locality?.trim();
    if (!postalCode || !locality) {
      return null;
    }

    const originCenterId =
      params.originOperationalCenterId ??
      (await this.operationalCenters.getDefaultEntity(companyId)).id;

    const exact = await this.findRateByUniqueRoute(
      companyId,
      originCenterId,
      postalCode,
      locality,
    );
    if (exact) {
      return exact;
    }

    const normalizedPostalCode = this.normalizeRouteDestinationPostalCode(postalCode);
    const normalizedLocality = this.normalizeRouteDestinationLocality(locality);
    const matches = await this.repo.find({
      where: {
        companyId,
        postalCode: normalizedPostalCode,
        locality: normalizedLocality,
      },
    });
    if (matches.length === 1) {
      return matches[0];
    }
    return null;
  }

  async linkClientsWithMatchingDelivery(
    companyId: number,
    rate: DestinationRate,
  ): Promise<void> {
    const postalCode = this.normalizeRouteDestinationPostalCode(rate.postalCode);
    const locality = this.normalizeRouteDestinationLocality(rate.locality);
    if (!postalCode || !locality) {
      return;
    }

    await this.clientDeliveryRepo
      .createQueryBuilder()
      .update(ClientDelivery)
      .set({
        destinationRateId: rate.id,
        isUnpricedRoute: false,
      })
      .where('postal_code = :postalCode', { postalCode })
      .andWhere('locality = :locality', { locality })
      .andWhere(
        '(destination_rate_id IS NULL OR is_unpriced_route = TRUE)',
      )
      .andWhere(
        `client_id IN (
          SELECT id FROM terminalops.clients WHERE company_id = :companyId
        )`,
        { companyId },
      )
      .execute();
  }

  async resolveRateIdForTrip(
    companyId: number,
    destinationRateId: string | undefined,
    fallback?: {
      originOperationalCenterId?: number;
      destinationPostalCode?: string;
      destinationLocality?: string;
    },
  ): Promise<number | undefined> {
    const explicitId = parseOptionalNumericId(destinationRateId);
    if (explicitId != null) {
      const row = await this.repo.findOne({
        where: { companyId, id: explicitId },
      });
      if (!row) {
        throw new NotFoundException(`Destination rate ${explicitId} not found`);
      }
      return row.id;
    }
    if (
      fallback?.originOperationalCenterId != null &&
      fallback.destinationPostalCode?.trim() &&
      fallback.destinationLocality?.trim()
    ) {
      const matched = await this.findMatchingRate(companyId, {
        originOperationalCenterId: fallback.originOperationalCenterId,
        destinationPostalCode: fallback.destinationPostalCode,
        destinationLocality: fallback.destinationLocality,
      });
      return matched?.id;
    }
    return undefined;
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

    const nextOriginCenterId =
      dto.originOperationalCenterId != null
        ? parseOptionalNumericId(dto.originOperationalCenterId)
        : existing.originOperationalCenterId;
    if (nextOriginCenterId == null) {
      throw new NotFoundException('Centro operativo de origen inválido');
    }
    const originCenter = await this.operationalCenters.resolveCenterId(
      companyId,
      nextOriginCenterId,
    );
    const nextPostal = dto.postalCode?.trim() ?? existing.postalCode;
    const nextLocality = dto.locality?.trim() ?? existing.locality;
    if (
      nextOriginCenterId !== existing.originOperationalCenterId ||
      nextPostal !== existing.postalCode ||
      nextLocality !== existing.locality
    ) {
      await this.assertUniqueRoute(
        companyId,
        nextOriginCenterId,
        nextPostal,
        nextLocality,
        rateId,
      );
    }

    const distanceFields =
      dto.routeDistanceKm !== undefined
        ? this.resolveDistanceFieldsForPersist(
            dto.routeDistanceKm,
            dto.isRoundTrip !== undefined ? dto.isRoundTrip : existing.isRoundTrip,
          )
        : undefined;
    const originSnapshot = this.operationalCenters.snapshotFromCenter(originCenter);

    await this.repo.update(
      { id: rateId, companyId },
      {
        ...(dto.originOperationalCenterId !== undefined && {
          originOperationalCenterId: originCenter.id,
          originPostalCode: originSnapshot.originPostalCode,
          originCityMunicipality: originSnapshot.originCityMunicipality,
          originLocality: originSnapshot.originLocality,
          originLatitude: originSnapshot.originLatitude,
          originLongitude: originSnapshot.originLongitude,
        }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode.trim() }),
        ...(dto.cityMunicipality !== undefined && {
          cityMunicipality: dto.cityMunicipality.trim(),
        }),
        ...(dto.locality !== undefined && { locality: dto.locality.trim() }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && {
          notes: dto.notes.trim() || undefined,
        }),
        ...(dto.destinationLatitude !== undefined && {
          destinationLatitude: String(dto.destinationLatitude),
        }),
        ...(dto.destinationLongitude !== undefined && {
          destinationLongitude: String(dto.destinationLongitude),
        }),
        ...(distanceFields && {
          routeDistanceKm: distanceFields.routeDistanceKm,
          operationalDistanceKm: distanceFields.operationalDistanceKm,
          distanceCalculatedAt: new Date(),
        }),
        ...(dto.isRoundTrip !== undefined && { isRoundTrip: dto.isRoundTrip }),
        ...this.resolveEstimatedTimeFieldsForUpdate(dto),
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

  private resolveEstimatedTimeFieldsForPersist(
    dto: Pick<
      CreateDestinationRateDto,
      | 'estimatedArrivalTimeValue'
      | 'estimatedReturnTimeValue'
      | 'estimatedTimeUnit'
    >,
  ):
    | {
        estimatedArrivalTimeValue: string;
        estimatedReturnTimeValue: string;
        estimatedTimeUnit: 'hours' | 'days';
      }
    | Record<string, never> {
    const hasAny =
      dto.estimatedArrivalTimeValue != null ||
      dto.estimatedReturnTimeValue != null ||
      dto.estimatedTimeUnit != null;
    if (!hasAny) {
      return {};
    }
    const arrival = dto.estimatedArrivalTimeValue;
    const returnValue = dto.estimatedReturnTimeValue;
    const unit = dto.estimatedTimeUnit;
    if (
      arrival == null ||
      returnValue == null ||
      !unit ||
      arrival <= 0 ||
      returnValue <= 0
    ) {
      throw new BadRequestException(
        'Los tiempos estimados requieren valor de ida, retorno y unidad (hours o days).',
      );
    }
    return {
      estimatedArrivalTimeValue: String(arrival),
      estimatedReturnTimeValue: String(returnValue),
      estimatedTimeUnit: unit,
    };
  }

  private resolveEstimatedTimeFieldsForUpdate(
    dto: UpdateDestinationRateDto,
  ): Record<string, string | 'hours' | 'days' | null | undefined> {
    const touched =
      dto.estimatedArrivalTimeValue !== undefined ||
      dto.estimatedReturnTimeValue !== undefined ||
      dto.estimatedTimeUnit !== undefined;
    if (!touched) {
      return {};
    }
    const hasAny =
      dto.estimatedArrivalTimeValue != null ||
      dto.estimatedReturnTimeValue != null ||
      dto.estimatedTimeUnit != null;
    if (!hasAny) {
      return {
        estimatedArrivalTimeValue: null,
        estimatedReturnTimeValue: null,
        estimatedTimeUnit: null,
      };
    }
    const resolved = this.resolveEstimatedTimeFieldsForPersist(dto);
    return resolved;
  }

  private resolveDistanceFieldsForPersist(
    routeDistanceKm: number | undefined,
    isRoundTrip: boolean,
  ): { routeDistanceKm: string; operationalDistanceKm: string } | undefined {
    if (routeDistanceKm === undefined || routeDistanceKm === null) {
      return undefined;
    }
    const breakdown = resolveTripOperationalDistance(routeDistanceKm, isRoundTrip);
    return {
      routeDistanceKm: String(breakdown.routeDistanceKm),
      operationalDistanceKm: String(breakdown.operationalDistanceKm),
    };
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

  private normalizeRouteDestinationPostalCode(postalCode: string): string {
    return postalCode.trim();
  }

  private normalizeRouteDestinationLocality(locality: string): string {
    return locality.trim();
  }

  /** Same lookup used by check-exists, assertUniqueRoute and DB UNIQUE constraint. */
  private async findRateByUniqueRoute(
    companyId: number,
    originOperationalCenterId: number,
    destinationPostalCode: string,
    destinationLocality: string,
  ): Promise<DestinationRate | null> {
    return this.repo.findOne({
      where: {
        companyId,
        originOperationalCenterId,
        postalCode: this.normalizeRouteDestinationPostalCode(destinationPostalCode),
        locality: this.normalizeRouteDestinationLocality(destinationLocality),
      },
    });
  }

  private async assertUniqueRoute(
    companyId: number,
    originOperationalCenterId: number,
    destinationPostalCode: string,
    destinationLocality: string,
    excludeId?: number,
  ): Promise<void> {
    const row = await this.findRateByUniqueRoute(
      companyId,
      originOperationalCenterId,
      destinationPostalCode,
      destinationLocality,
    );
    if (row && row.id !== excludeId) {
      throw new ConflictException('Ya existe una tarifa para esta ruta');
    }
  }
}
