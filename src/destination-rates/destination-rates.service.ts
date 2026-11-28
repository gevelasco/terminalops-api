import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  normalizeDestinationRateScope,
  normalizePlaceKey,
  parseCityMunicipalityLine,
  type DestinationRateScope,
} from 'src/common/constants/destination-rate-scope';
import {
  serializeDestinationRate,
  serializeDestinationRateSummary,
} from 'src/common/serializers/destination-rate.serializer';
import { normalizeRouteTollPlazas } from 'src/common/utils/route-toll-plazas.util';
import { normalizeRouteWaypoints } from 'src/common/utils/route-waypoints.util';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { Company } from 'src/companies/entities/company.entity';
import { OperationalCentersService } from 'src/operational-centers/operational-centers.service';
import { OperationConfigurationsService } from 'src/operation-configurations/operation-configurations.service';
import { resolveTripOperationalDistance } from 'src/trips/trip-operational-distance.util';
import { CreateDestinationRateDto } from './dto/create-destination-rate.dto';
import { DestinationRatePriceInputDto } from './dto/destination-rate-price-input.dto';
import { UpdateDestinationRateDto } from './dto/update-destination-rate.dto';
import { ClientDelivery } from '../clients/entities/client-delivery.entity';
import { DestinationRatePrice } from './entities/destination-rate-price.entity';
import { DestinationRate } from './entities/destination-rate.entity';

type DestinationRouteLookup = {
  postalCode?: string;
  locality?: string;
  municipalityName?: string;
  stateName?: string;
  cityMunicipality?: string;
};

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
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
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
    const scope = await this.companyDestinationRateScope(companyId);
    const routeFields = this.resolveRouteFieldsForScope(scope, dto);
    await this.assertUniqueRoute(companyId, originCenter.id, scope, routeFields);
    await this.assertUniquePriceConfigs(dto.prices);
    const priceRows = await this.buildPriceEntities(companyId, dto.prices);
    const distanceFields = this.resolveDistanceFieldsForPersist(dto.routeDistanceKm);
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
        postalCode: routeFields.postalCode,
        cityMunicipality: routeFields.cityMunicipality,
        locality: routeFields.locality,
        destinationScope: scope,
        routeKeyIncomplete: false,
        municipalityName: routeFields.municipalityName,
        stateName: routeFields.stateName,
        destinationLatitude:
          dto.destinationLatitude != null
            ? String(dto.destinationLatitude)
            : undefined,
        destinationLongitude:
          dto.destinationLongitude != null
            ? String(dto.destinationLongitude)
            : undefined,
        routeDistanceKm: distanceFields?.routeDistanceKm,
        distanceCalculatedAt: distanceFields ? new Date() : undefined,
        ...estimatedTimeFields,
        active: dto.active ?? true,
        notes: dto.notes?.trim() || undefined,
        routeWaypoints: normalizeRouteWaypoints(dto.routeWaypoints ?? []),
        routeTollPlazas: normalizeRouteTollPlazas(dto.routeTollPlazas ?? []),
        prices: priceRows,
      }),
    );
    await this.linkClientsWithMatchingDelivery(companyId, saved);
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number) {
    // Solo lectura: el colapso de duplicados corre al cambiar la política
    // (migrateCompanyScope), no en cada listado.
    const rows = await this.repo
      .createQueryBuilder('rate')
      .leftJoinAndSelect('rate.prices', 'prices')
      .leftJoinAndSelect('prices.operationConfiguration', 'operationConfiguration')
      .where('rate.companyId = :companyId', { companyId })
      .andWhere('rate.active = true')
      .orderBy('rate.postalCode', 'ASC')
      .addOrderBy('rate.locality', 'ASC')
      .getMany();
    await this.applyManeuverCounts(companyId, rows);
    return rows.map((row) => serializeDestinationRateSummary(row));
  }

  async findOne(companyId: number, rateId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: rateId },
      relations: [...RATE_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Destination rate ${rateId} not found`);
    }
    row.maneuverCount = await this.countLiveManeuvers(companyId, rateId);
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
      destinationPostalCode?: string;
      destinationLocality?: string;
      municipalityName?: string;
      stateName?: string;
      cityMunicipality?: string;
      activeOnly?: boolean;
    },
  ): Promise<DestinationRate | null> {
    const scope = await this.companyDestinationRateScope(companyId);
    return this.findRateByUniqueRoute(
      companyId,
      params.originOperationalCenterId,
      scope,
      {
        postalCode: params.destinationPostalCode,
        locality: params.destinationLocality,
        municipalityName: params.municipalityName,
        stateName: params.stateName,
        cityMunicipality: params.cityMunicipality,
      },
      params.activeOnly !== false,
    );
  }

  /**
   * Batch map lookup: one query for many (postal, locality) destinations
   * from the same origin center. Returns coords-only matches keyed by
   * normalized "postal|locality".
   */
  async findMatchingRatesForMapDestinations(
    companyId: number,
    originOperationalCenterId: number,
    destinations: ReadonlyArray<{
      destinationPostalCode: string;
      destinationLocality: string;
    }>,
  ): Promise<
    Map<
      string,
      {
        destinationLatitude: string | number | null;
        destinationLongitude: string | number | null;
        postalCode: string;
        locality: string;
      }
    >
  > {
    const unique = new Map<
      string,
      { postalCode: string; locality: string }
    >();
    for (const dest of destinations) {
      const postalCode = this.normalizeRouteDestinationPostalCode(
        dest.destinationPostalCode,
      );
      const locality = this.normalizeRouteDestinationLocality(
        dest.destinationLocality,
      );
      if (!postalCode || !locality) {
        continue;
      }
      unique.set(`${postalCode}|${locality.toLowerCase()}`, {
        postalCode,
        locality,
      });
    }
    if (unique.size === 0) {
      return new Map();
    }

    const pairs = [...unique.values()];
    const qb = this.repo
      .createQueryBuilder('rate')
      .select([
        'rate.id',
        'rate.postalCode',
        'rate.locality',
        'rate.destinationLatitude',
        'rate.destinationLongitude',
      ])
      .where('rate.companyId = :companyId', { companyId })
      .andWhere('rate.originOperationalCenterId = :originOperationalCenterId', {
        originOperationalCenterId,
      })
      .andWhere('rate.active = true');

    qb.andWhere(
      pairs
        .map(
          (_, i) =>
            `(rate.postalCode = :postal${i} AND LOWER(BTRIM(rate.locality)) = LOWER(BTRIM(:locality${i})))`,
        )
        .join(' OR '),
      Object.fromEntries(
        pairs.flatMap((pair, i) => [
          [`postal${i}`, pair.postalCode],
          [`locality${i}`, pair.locality],
        ]),
      ),
    );

    const rows = await qb.getMany();
    const out = new Map<
      string,
      {
        destinationLatitude: string | number | null;
        destinationLongitude: string | number | null;
        postalCode: string;
        locality: string;
      }
    >();
    for (const row of rows) {
      const key = `${this.normalizeRouteDestinationPostalCode(row.postalCode)}|${this.normalizeRouteDestinationLocality(row.locality).toLowerCase()}`;
      out.set(key, {
        destinationLatitude: row.destinationLatitude ?? null,
        destinationLongitude: row.destinationLongitude ?? null,
        postalCode: row.postalCode,
        locality: row.locality,
      });
    }
    return out;
  }

  async checkRouteExists(
    companyId: number,
    params: DestinationRouteLookup & { originOperationalCenterId: string },
  ): Promise<{ exists: boolean; destinationRateId?: number }> {
    const originCenterId = parseOptionalNumericId(params.originOperationalCenterId);
    if (originCenterId == null) {
      return { exists: false };
    }
    await this.operationalCenters.resolveCenterId(companyId, originCenterId);
    const scope = await this.companyDestinationRateScope(companyId);
    const row = await this.findRateByUniqueRoute(
      companyId,
      originCenterId,
      scope,
      params,
    );
    if (!row) {
      return { exists: false };
    }
    return { exists: true, destinationRateId: row.id };
  }

  /**
   * Match fino para el drawer de nueva maniobra: ruta operativa activa +
   * preferencia por la tarifa vinculada a la entrega del cliente.
   * Misma semántica que `resolveManeuverDestinationRate` en el front.
   */
  async matchManeuverRate(
    companyId: number,
    params: DestinationRouteLookup & {
      originOperationalCenterId: string;
      clientDestinationRateId?: string;
    },
  ): Promise<{ rate: ReturnType<typeof serializeDestinationRate> | null }> {
    const originCenterId = parseOptionalNumericId(params.originOperationalCenterId);
    if (originCenterId == null) {
      return { rate: null };
    }
    await this.operationalCenters.resolveCenterId(companyId, originCenterId);
    const scope = await this.companyDestinationRateScope(companyId);

    const routeMatch = await this.findMatchingRate(companyId, {
      originOperationalCenterId: originCenterId,
      destinationPostalCode: params.postalCode,
      destinationLocality: params.locality,
      municipalityName: params.municipalityName,
      stateName: params.stateName,
      cityMunicipality: params.cityMunicipality,
    });

    const linkedId = params.clientDestinationRateId
      ? parseOptionalNumericId(params.clientDestinationRateId)
      : null;
    if (linkedId == null) {
      return { rate: routeMatch ? serializeDestinationRate(routeMatch) : null };
    }

    const linked = await this.getRateEntity(companyId, linkedId);
    if (!linked || !linked.active) {
      return { rate: routeMatch ? serializeDestinationRate(routeMatch) : null };
    }

    const linkedMatchesRoute =
      linked.originOperationalCenterId === originCenterId &&
      this.rateMatchesLookup(linked, scope, params);
    if (!linkedMatchesRoute) {
      // Entrega con tarifa desalineada: usar match por ruta, no bloquear sugerencias.
      return { rate: routeMatch ? serializeDestinationRate(routeMatch) : null };
    }
    return { rate: serializeDestinationRate(linked) };
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
      cityMunicipality?: string;
      municipalityName?: string;
      stateName?: string;
      originOperationalCenterId?: number;
    },
  ): Promise<DestinationRate | null> {
    const lookup: DestinationRouteLookup = {
      postalCode: params.postalCode?.trim() || undefined,
      locality: params.locality?.trim() || undefined,
      cityMunicipality: params.cityMunicipality?.trim() || undefined,
      municipalityName: params.municipalityName?.trim() || undefined,
      stateName: params.stateName?.trim() || undefined,
    };

    const originCenterId =
      params.originOperationalCenterId ??
      (await this.operationalCenters.getDefaultEntity(companyId)).id;

    const scope = await this.companyDestinationRateScope(companyId);
    const fields = this.resolveRouteFieldsForScopeSafe(scope, lookup);
    if (!fields) {
      return null;
    }

    const exact = await this.findRateByUniqueRoute(
      companyId,
      originCenterId,
      scope,
      lookup,
    );
    if (exact) {
      return exact;
    }

    const qb = this.repo
      .createQueryBuilder('rate')
      .where('rate.companyId = :companyId', { companyId })
      .andWhere('rate.destinationScope = :scope', { scope })
      .andWhere('rate.routeKeyIncomplete = false');

    if (scope === 'postal_code') {
      qb.andWhere('rate.postalCode = :postalCode', {
        postalCode: fields.postalCode,
      }).andWhere('LOWER(BTRIM(rate.locality)) = LOWER(BTRIM(:locality))', {
        locality: fields.locality,
      });
    } else if (scope === 'municipality') {
      qb.andWhere('LOWER(BTRIM(rate.stateName)) = LOWER(BTRIM(:stateName))', {
        stateName: fields.stateName,
      }).andWhere(
        'LOWER(BTRIM(rate.municipalityName)) = LOWER(BTRIM(:municipalityName))',
        { municipalityName: fields.municipalityName },
      );
    } else {
      qb.andWhere('LOWER(BTRIM(rate.stateName)) = LOWER(BTRIM(:stateName))', {
        stateName: fields.stateName,
      });
    }

    const matches = await qb.getMany();
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
      })
      .where('postal_code = :postalCode', { postalCode })
      .andWhere('LOWER(BTRIM(locality)) = LOWER(BTRIM(:locality))', { locality })
      .andWhere('destination_rate_id IS NULL')
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
    const scope = await this.companyDestinationRateScope(companyId);
    const nextLookup: DestinationRouteLookup = {
      postalCode: dto.postalCode?.trim() ?? existing.postalCode,
      locality: dto.locality?.trim() ?? existing.locality,
      municipalityName:
        dto.municipalityName?.trim() ?? existing.municipalityName,
      stateName: dto.stateName?.trim() ?? existing.stateName,
      cityMunicipality:
        dto.cityMunicipality?.trim() ?? existing.cityMunicipality,
    };
    const nextFields = this.resolveRouteFieldsForScope(scope, nextLookup);
    const routeChanged =
      nextOriginCenterId !== existing.originOperationalCenterId ||
      nextFields.postalCode !== existing.postalCode ||
      nextFields.locality.toLowerCase() !== existing.locality.trim().toLowerCase() ||
      normalizePlaceKey(nextFields.municipalityName) !==
        normalizePlaceKey(existing.municipalityName ?? '') ||
      normalizePlaceKey(nextFields.stateName) !==
        normalizePlaceKey(existing.stateName ?? '');
    if (routeChanged) {
      await this.assertUniqueRoute(
        companyId,
        nextOriginCenterId,
        scope,
        nextLookup,
        rateId,
      );
    }

    const distanceFields =
      dto.routeDistanceKm !== undefined
        ? this.resolveDistanceFieldsForPersist(dto.routeDistanceKm)
        : undefined;
    const originSnapshot = this.operationalCenters.snapshotFromCenter(originCenter);

    await this.repo.update(
      { id: rateId, companyId },
      {
        originOperationalCenterId: originCenter.id,
        originPostalCode: originSnapshot.originPostalCode,
        originCityMunicipality: originSnapshot.originCityMunicipality,
        originLocality: originSnapshot.originLocality,
        originLatitude: originSnapshot.originLatitude,
        originLongitude: originSnapshot.originLongitude,
        ...(routeChanged
          ? {
              postalCode: nextFields.postalCode,
              cityMunicipality: nextFields.cityMunicipality,
              locality: nextFields.locality,
              municipalityName: nextFields.municipalityName,
              stateName: nextFields.stateName,
              destinationScope: scope,
              routeKeyIncomplete: false,
            }
          : {
              ...(dto.postalCode !== undefined && {
                postalCode: dto.postalCode.trim(),
              }),
              ...(dto.cityMunicipality !== undefined && {
                cityMunicipality: dto.cityMunicipality.trim(),
              }),
              ...(dto.locality !== undefined && { locality: dto.locality.trim() }),
              ...(dto.municipalityName !== undefined && {
                municipalityName: dto.municipalityName.trim(),
              }),
              ...(dto.stateName !== undefined && {
                stateName: dto.stateName.trim(),
              }),
            }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.notes !== undefined && {
          notes: dto.notes.trim() || undefined,
        }),
        ...(dto.routeWaypoints !== undefined && {
          routeWaypoints: normalizeRouteWaypoints(dto.routeWaypoints),
        }),
        ...(dto.routeTollPlazas !== undefined && {
          routeTollPlazas: normalizeRouteTollPlazas(dto.routeTollPlazas),
        }),
        ...(dto.destinationLatitude !== undefined && {
          destinationLatitude: String(dto.destinationLatitude),
        }),
        ...(dto.destinationLongitude !== undefined && {
          destinationLongitude: String(dto.destinationLongitude),
        }),
        ...(distanceFields && {
          routeDistanceKm: distanceFields.routeDistanceKm,
          distanceCalculatedAt: new Date(),
        }),
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
    const maneuverCount = await this.countLiveManeuvers(companyId, rateId);
    if (maneuverCount > 0) {
      throw new ConflictException(
        `No se puede eliminar: hay ${maneuverCount} maniobra(s) vinculada(s). Desactiva la tarifa en su lugar.`,
      );
    }
    await this.repo.delete({ id: rateId, companyId });
    return { id: rateId, deleted: true };
  }

  private async applyManeuverCounts(
    companyId: number,
    rows: DestinationRate[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const ids = rows.map((row) => row.id);
    const raw = await this.repo
      .createQueryBuilder('rate')
      .innerJoin('rate.trips', 'trip')
      .where('rate.companyId = :companyId', { companyId })
      .andWhere('rate.id IN (:...ids)', { ids })
      .andWhere('trip.deletedAt IS NULL')
      .select('rate.id', 'rateId')
      .addSelect('COUNT(trip.id)', 'cnt')
      .groupBy('rate.id')
      .getRawMany<{ rateId: string; cnt: string }>();
    const byId = new Map(raw.map((row) => [Number(row.rateId), Number(row.cnt)]));
    for (const row of rows) {
      row.maneuverCount = byId.get(row.id) ?? 0;
    }
  }

  private async countLiveManeuvers(
    companyId: number,
    rateId: number,
  ): Promise<number> {
    const raw = await this.repo
      .createQueryBuilder('rate')
      .innerJoin('rate.trips', 'trip')
      .where('rate.id = :rateId', { rateId })
      .andWhere('rate.companyId = :companyId', { companyId })
      .andWhere('trip.deletedAt IS NULL')
      .select('COUNT(trip.id)', 'cnt')
      .getRawOne<{ cnt: string }>();
    return Number(raw?.cnt ?? 0);
  }

  private resolveEstimatedTimeFieldsForPersist(
    dto: Pick<
      CreateDestinationRateDto,
      'estimatedArrivalTimeValue' | 'estimatedReturnTimeValue'
    >,
  ):
    | {
        estimatedArrivalTimeValue: string;
        estimatedReturnTimeValue: string;
      }
    | Record<string, never> {
    const hasAny =
      dto.estimatedArrivalTimeValue != null ||
      dto.estimatedReturnTimeValue != null;
    if (!hasAny) {
      return {};
    }
    const arrival = dto.estimatedArrivalTimeValue;
    const returnValue = dto.estimatedReturnTimeValue;
    if (
      arrival == null ||
      returnValue == null ||
      arrival <= 0 ||
      returnValue <= 0
    ) {
      throw new BadRequestException(
        'Los tiempos de manejo requieren ida y retorno en horas (mayor a 0).',
      );
    }
    return {
      estimatedArrivalTimeValue: String(arrival),
      estimatedReturnTimeValue: String(returnValue),
    };
  }

  private resolveEstimatedTimeFieldsForUpdate(
    dto: UpdateDestinationRateDto,
  ): Record<string, string | null | undefined> {
    const touched =
      dto.estimatedArrivalTimeValue !== undefined ||
      dto.estimatedReturnTimeValue !== undefined;
    if (!touched) {
      return {};
    }
    const hasAny =
      dto.estimatedArrivalTimeValue != null ||
      dto.estimatedReturnTimeValue != null;
    if (!hasAny) {
      return {
        estimatedArrivalTimeValue: null,
        estimatedReturnTimeValue: null,
      };
    }
    return this.resolveEstimatedTimeFieldsForPersist(dto);
  }

  private resolveDistanceFieldsForPersist(
    routeDistanceKm: number | undefined,
  ): { routeDistanceKm: string } | undefined {
    if (routeDistanceKm === undefined || routeDistanceKm === null) {
      return undefined;
    }
    const breakdown = resolveTripOperationalDistance(routeDistanceKm);
    return {
      routeDistanceKm: String(breakdown.routeDistanceKm),
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
          axleCount:
            input.axleCount != null && input.axleCount >= 2
              ? Math.round(input.axleCount)
              : undefined,
          perDiemAmount: String(input.perDiemAmount ?? 0),
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

  private async companyDestinationRateScope(
    companyId: number,
  ): Promise<DestinationRateScope> {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
      select: ['id', 'destinationRateScope'],
    });
    return normalizeDestinationRateScope(company?.destinationRateScope);
  }

  private resolveRouteFieldsForScope(
    scope: DestinationRateScope,
    dto: DestinationRouteLookup,
  ): {
    postalCode: string;
    locality: string;
    cityMunicipality: string;
    municipalityName: string;
    stateName: string;
  } {
    const parsed = parseCityMunicipalityLine(dto.cityMunicipality ?? '');
    const municipalityName = (
      dto.municipalityName?.trim() || parsed.municipality
    ).trim();
    // Scope estado guarda cityMunicipality = "Puebla" (sin coma); parse la deja en municipality.
    const stateName = (
      dto.stateName?.trim() ||
      parsed.state ||
      (scope === 'state' && !parsed.state
        ? (dto.cityMunicipality ?? '').trim()
        : '')
    ).trim();

    if (scope === 'postal_code') {
      const postalCode = this.normalizeRouteDestinationPostalCode(
        dto.postalCode ?? '',
      );
      const locality = this.normalizeRouteDestinationLocality(dto.locality ?? '');
      if (!postalCode || !locality) {
        throw new BadRequestException(
          'Código postal y localidad son obligatorios para tarifas por CP',
        );
      }
      const cityMunicipality =
        (dto.cityMunicipality ?? '').trim() ||
        [municipalityName, stateName].filter(Boolean).join(', ');
      return {
        postalCode,
        locality,
        cityMunicipality,
        municipalityName,
        stateName,
      };
    }

    if (scope === 'municipality') {
      if (!municipalityName || !stateName) {
        throw new BadRequestException(
          'Municipio y estado son obligatorios para tarifas por municipio',
        );
      }
      return {
        postalCode: '',
        locality: '',
        cityMunicipality: `${municipalityName}, ${stateName}`,
        municipalityName,
        stateName,
      };
    }

    if (!stateName) {
      throw new BadRequestException(
        'Estado es obligatorio para tarifas por estado',
      );
    }
    return {
      postalCode: '',
      locality: '',
      cityMunicipality: stateName,
      municipalityName: '',
      stateName,
    };
  }

  private rateMatchesLookup(
    rate: DestinationRate,
    scope: DestinationRateScope,
    lookup: DestinationRouteLookup,
  ): boolean {
    if (rate.routeKeyIncomplete) {
      return false;
    }
    const fields = this.resolveRouteFieldsForScopeSafe(scope, lookup);
    if (!fields) {
      return false;
    }
    if (scope === 'postal_code') {
      return (
        rate.postalCode === fields.postalCode &&
        rate.locality.trim().toLowerCase() === fields.locality.toLowerCase()
      );
    }
    if (scope === 'municipality') {
      return (
        normalizePlaceKey(rate.stateName) === normalizePlaceKey(fields.stateName) &&
        normalizePlaceKey(rate.municipalityName) ===
          normalizePlaceKey(fields.municipalityName)
      );
    }
    return (
      normalizePlaceKey(rate.stateName) === normalizePlaceKey(fields.stateName)
    );
  }

  private resolveRouteFieldsForScopeSafe(
    scope: DestinationRateScope,
    dto: DestinationRouteLookup,
  ): {
    postalCode: string;
    locality: string;
    municipalityName: string;
    stateName: string;
  } | null {
    try {
      return this.resolveRouteFieldsForScope(scope, dto);
    } catch {
      return null;
    }
  }

  /** Same lookup used by check-exists, assertUniqueRoute and DB UNIQUE constraint. */
  private async findRateByUniqueRoute(
    companyId: number,
    originOperationalCenterId: number,
    scope: DestinationRateScope,
    lookup: DestinationRouteLookup,
    activeOnly?: boolean,
  ): Promise<DestinationRate | null> {
    const fields = this.resolveRouteFieldsForScopeSafe(scope, lookup);
    if (!fields) {
      return null;
    }
    const qb = this.repo
      .createQueryBuilder('rate')
      .leftJoinAndSelect('rate.prices', 'prices')
      .leftJoinAndSelect('prices.operationConfiguration', 'operationConfiguration')
      .leftJoinAndSelect('rate.originOperationalCenter', 'originOperationalCenter')
      .where('rate.companyId = :companyId', { companyId })
      .andWhere('rate.originOperationalCenterId = :originOperationalCenterId', {
        originOperationalCenterId,
      })
      .andWhere('rate.destinationScope = :scope', { scope })
      .andWhere('rate.routeKeyIncomplete = false');

    if (scope === 'postal_code') {
      qb.andWhere('rate.postalCode = :postalCode', {
        postalCode: fields.postalCode,
      }).andWhere('LOWER(BTRIM(rate.locality)) = LOWER(BTRIM(:locality))', {
        locality: fields.locality,
      });
    } else if (scope === 'municipality') {
      qb.andWhere(
        'LOWER(BTRIM(rate.stateName)) = LOWER(BTRIM(:stateName))',
        { stateName: fields.stateName },
      ).andWhere(
        'LOWER(BTRIM(rate.municipalityName)) = LOWER(BTRIM(:municipalityName))',
        { municipalityName: fields.municipalityName },
      );
    } else {
      qb.andWhere(
        'LOWER(BTRIM(rate.stateName)) = LOWER(BTRIM(:stateName))',
        { stateName: fields.stateName },
      );
    }

    if (activeOnly === true) {
      qb.andWhere('rate.active = true');
    }
    return qb.getOne();
  }

  /**
   * Una tarifa + su centro de origen (sin prices ni catálogo completo).
   * Para el drawer de maniobra: no sustituye GET /destination-rates.
   */
  async findTripDrawerDisplay(
    companyId: number,
    destinationRateId: number | null | undefined,
  ): Promise<{
    destinationRateSummary: string | null;
    originOperationalCenterId: number | null;
    originOperationalCenterLabel: string | null;
  }> {
    if (destinationRateId == null) {
      return {
        destinationRateSummary: null,
        originOperationalCenterId: null,
        originOperationalCenterLabel: null,
      };
    }
    const rate = await this.repo.findOne({
      where: { companyId, id: destinationRateId },
      relations: ['originOperationalCenter'],
    });
    if (!rate) {
      return {
        destinationRateSummary: null,
        originOperationalCenterId: null,
        originOperationalCenterLabel: null,
      };
    }
    const origin =
      rate.originLocality?.trim() ||
      rate.originOperationalCenter?.name?.trim() ||
      'Origen';
    const dest = rate.locality?.trim() || rate.postalCode?.trim() || 'Destino';
    const summary = `${origin} → ${dest}`;
    const cp = rate.postalCode?.trim();
    const center = rate.originOperationalCenter;
    const name = center?.name?.trim();
    const code = center?.code?.trim();
    let originOperationalCenterLabel: string | null = null;
    if (name && code) {
      originOperationalCenterLabel = `${name} (${code})`;
    } else {
      originOperationalCenterLabel = name || code || null;
    }
    return {
      destinationRateSummary: cp ? `${summary} · CP ${cp}` : summary,
      originOperationalCenterId: center?.id ?? rate.originOperationalCenterId ?? null,
      originOperationalCenterLabel,
    };
  }

  private async assertUniqueRoute(
    companyId: number,
    originOperationalCenterId: number,
    scope: DestinationRateScope,
    lookup: DestinationRouteLookup,
    excludeId?: number,
  ): Promise<void> {
    const row = await this.findRateByUniqueRoute(
      companyId,
      originOperationalCenterId,
      scope,
      lookup,
    );
    if (row && row.id !== excludeId) {
      throw new ConflictException('Ya existe una tarifa para esta ruta');
    }
  }
}
