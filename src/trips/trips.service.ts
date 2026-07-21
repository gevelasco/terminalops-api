import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, type EntityManager } from 'typeorm';
import { isAdminRole } from 'src/common/constants/app-modules';
import { assertTripBitacoraAccess } from 'src/common/utils/module-permission.util';
import type AuthUser from 'src/types/auth-user.type';
import {
  buildIncidentAuthorLookup,
  type IncidentAuthorLookup,
} from 'src/common/utils/incident-author.util';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { AppUser } from 'src/users/entities/app-user.entity';
import { Client } from 'src/clients/entities/client.entity';
import { Company } from 'src/companies/entities/company.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { assertFleetResourceActive } from 'src/fleet/fleet-resource-active.util';
import { assertFleetResourceAssignableForTrip } from 'src/fleet/fleet-resource-assignable.util';
import { ExpensesService } from 'src/expenses/expenses.service';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { AddIncidentDto } from './dto/add-incident.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateActualScheduleDto } from './dto/update-actual-schedule.dto';
import type { ListTripLinkOptionsQueryDto } from './dto/list-trip-link-options-query.dto';
import { isFleetLinkOptionsSearchAllowed } from 'src/fleet/fleet-link-options-search.util';
import type { ListTripsQueryDto } from './dto/list-trips-query.dto';
import {
  applyTripListFilters,
  normalizeTripListLimit,
} from './trips-list.util';
import { tripNotDeletedSql } from './trip-visibility.util';
import { mapTripLinkOption } from './trip-link-option.mapper';
import { UpdateTripDto } from './dto/update-trip.dto';
import type { ClientCargoHistoryResponseDto } from './dto/client-cargo-history.dto';
import { mapTripToResponse } from './trips.mapper';
import { DestinationRatesService } from 'src/destination-rates/destination-rates.service';
import { OperationalCentersService } from 'src/operational-centers/operational-centers.service';
import { OperationConfigurationsService } from 'src/operation-configurations/operation-configurations.service';
import { normalizeOperationConfigCode } from 'src/common/utils/operation-config-code.util';
import { resolveTripOperationalDistance } from './trip-operational-distance.util';
import {
  formatManeuverCode,
  maneuverCodePrefixFromClientName,
} from './maneuver-code.util';
import {
  MISSING_PLANNED_FIELDS_REASON,
  parseRequiredPlannedScheduleFromCreateDto,
  REQUIRED_PLANNED_SCHEDULE_MESSAGE,
  validatePlannedScheduleUpdate,
} from './lifecycle/resolve-planned-schedule';
import { TripFleetStatusSyncService } from './lifecycle/trip-fleet-status-sync.service';
import { TripLifecycleService } from './lifecycle/trip-lifecycle.service';
import { UnitTripOdometerService } from 'src/units/unit-trip-odometer.service';
import { rejectLegacyScheduleFields } from './reject-legacy-trip-schedule-fields';
import { rejectClientTripStatusMutation } from './trip-status-lock.util';
import { assertResourceNotOnActiveTrip } from './trip-fleet-assignment-guard.util';
import {
  assertNoSnapshotMutation,
  assertNoSnapshotMutationDto,
} from './trip-snapshot-immutability.util';
import type { ActualScheduleFieldKey } from './actual-schedule/actual-schedule.constants';
import { buildConsolidatedScheduleUpdateIncidentDescription } from './actual-schedule/actual-schedule-incident.util';
import { syncTripIncidentMarkers } from './trip-incident-markers.util';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { TripLoadPlacesService } from 'src/trips/trip-load-places.service';
import { COMPANY_ACTIVITY_KIND } from 'src/activity-events/company-activity-event.kinds';
import {
  applyActualScheduleDeltas,
  assertActualScheduleChronology,
  detectActualScheduleDeltas,
  parseOptionalIsoDate,
  rejectDisallowedActualScheduleBodyKeys,
} from './actual-schedule/actual-schedule-update.util';
import type { TripsMapResponseDto } from './dto/trip-map-item.dto';
import {
  buildTripsMapMeta,
  mapTripToMapItem,
  type TripGeoResolverContext,
} from './trip-geo-resolver.util';

export interface TripsListResult {
  items: ReturnType<typeof mapTripToResponse>[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripEquipment)
    private readonly tripEquipmentRepo: Repository<TripEquipment>,
    @InjectRepository(TripIncident)
    private readonly incidentsRepo: Repository<TripIncident>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(AppUser)
    private readonly usersRepo: Repository<AppUser>,
    private readonly operationConfigurations: OperationConfigurationsService,
    private readonly destinationRates: DestinationRatesService,
    private readonly operationalCenters: OperationalCentersService,
    private readonly tripLifecycle: TripLifecycleService,
    private readonly fleetStatusSync: TripFleetStatusSyncService,
    private readonly unitTripOdometer: UnitTripOdometerService,
    private readonly expensesService: ExpensesService,
    private readonly activityEvents: ActivityEventsService,
    private readonly tripLoadPlaces: TripLoadPlacesService,
  ) {}

  private tripRelations = [
    'client',
    'unit',
    'operator',
    'tripEquipment',
    'incidents',
  ] as const;

  async findAll(
    companyId: number,
    query?: ListTripsQueryDto,
  ): Promise<TripsListResult> {
    await this.tripLifecycle.ensureCompanyLifecycleFresh(companyId);

    const limit = normalizeTripListLimit(query?.limit);
    const page = Math.max(1, query?.page ?? 1);

    const baseQb = this.tripsRepo.createQueryBuilder('trip');
    applyTripListFilters(baseQb, companyId, query);
    const total = await baseQb.clone().getCount();

    const rowsQb = this.tripsRepo
      .createQueryBuilder('trip')
      .leftJoinAndSelect('trip.client', 'client')
      .leftJoinAndSelect('trip.unit', 'unit')
      .leftJoinAndSelect('trip.operator', 'operator')
      .leftJoinAndSelect('trip.tripEquipment', 'tripEquipment')
      .leftJoinAndSelect('trip.incidents', 'incidents');
    applyTripListFilters(rowsQb, companyId, query);
    rowsQb.orderBy('trip.createdAt', 'DESC');

    if (limit > 0) {
      rowsQb.skip((page - 1) * limit).take(limit);
    }

    const trips = await rowsQb.getMany();
    const equipmentIds = [
      ...new Set(
        trips.flatMap((t) =>
          (t.tripEquipment ?? []).map((te) => te.equipmentId),
        ),
      ),
    ];
    const [equipment, authorLookup] = await Promise.all([
      equipmentIds.length > 0
        ? this.equipmentRepo.find({
            where: { companyId, id: In(equipmentIds) },
            select: ['id', 'trailerBrandAbbr', 'trailerYear', 'plate'],
          })
        : Promise.resolve([]),
      this.loadAuthorLookup(companyId),
    ]);

    return {
      items: trips.map((t) => mapTripToResponse(t, equipment, authorLookup)),
      total,
      page: limit > 0 ? page : 1,
      limit: limit > 0 ? limit : total,
    };
  }

  /** Opciones ligeras para vincular gastos u otros formularios (sin joins pesados). */
  async findLinkOptions(
    companyId: number,
    query: ListTripLinkOptionsQueryDto = {},
  ) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const idRaw = query.id?.trim();
    if (idRaw) {
      const id = Number(idRaw);
      if (Number.isFinite(id) && id > 0) {
        const row = await this.tripsRepo.findOne({
          where: { companyId, id, deletedAt: IsNull() },
          select: [
            'id',
            'maneuverCode',
            'status',
            'falseManeuver',
            'plannedDepartureAt',
          ],
        });
        return { items: row ? [mapTripLinkOption(row)] : [] };
      }
      return { items: [] };
    }

    const search = query.search?.trim();
    if (!isFleetLinkOptionsSearchAllowed(search)) {
      return { items: [] };
    }

    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .select([
        'trip.id',
        'trip.maneuverCode',
        'trip.status',
        'trip.falseManeuver',
        'trip.plannedDepartureAt',
      ])
      .where('trip.companyId = :companyId', { companyId })
      .andWhere(tripNotDeletedSql('trip'))
      .orderBy('trip.plannedDepartureAt', 'DESC')
      .take(limit);

    qb.andWhere(
      '(trip.maneuver_code ILIKE :q OR CAST(trip.id AS TEXT) ILIKE :q)',
      { q: `%${search}%` },
    );

    const rows = await qb.getMany();
    return { items: rows.map(mapTripLinkOption) };
  }

  async findForMap(companyId: number): Promise<TripsMapResponseDto> {
    await this.tripLifecycle.ensureCompanyLifecycleFresh(companyId);

    const [trips, defaultCenter, operationalCenters] = await Promise.all([
      this.tripsRepo
        .createQueryBuilder('trip')
        .leftJoinAndSelect('trip.destinationRate', 'rate')
        .leftJoinAndSelect('trip.client', 'client')
        .leftJoinAndSelect('client.delivery', 'delivery')
        .where('trip.companyId = :companyId', { companyId })
        .andWhere(tripNotDeletedSql('trip'))
        .andWhere('trip.status IN (:...statuses)', {
          statuses: ['scheduled', 'in_transit'],
        })
        .orderBy('trip.plannedDepartureAt', 'ASC')
        .getMany(),
      this.operationalCenters.getDefaultEntity(companyId),
      this.operationalCenters.findAllEntities(companyId),
    ]);

    const destinationsNeedingMatch = trips
      .filter((trip) => {
        const rate = trip.destinationRate;
        if (
          this.hasGeoCoords(rate?.destinationLatitude, rate?.destinationLongitude)
        ) {
          return false;
        }
        const delivery = trip.client?.delivery;
        if (this.hasGeoCoords(delivery?.latitude, delivery?.longitude)) {
          return false;
        }
        return !!(
          trip.destinationPostalCode?.trim() &&
          trip.destinationLocality?.trim()
        );
      })
      .map((trip) => ({
        destinationPostalCode: trip.destinationPostalCode!.trim(),
        destinationLocality: trip.destinationLocality!.trim(),
      }));

    const matchedByKey =
      destinationsNeedingMatch.length > 0
        ? await this.destinationRates.findMatchingRatesForMapDestinations(
            companyId,
            defaultCenter.id,
            destinationsNeedingMatch,
          )
        : new Map();

    const items = trips.map((trip) => {
      const matchedRateDestination = this.resolveMatchedRateDestinationFromBatch(
        trip,
        matchedByKey,
      );
      const ctx: TripGeoResolverContext = {
        defaultCenter,
        operationalCenters,
        matchedRateDestination,
      };
      return mapTripToMapItem(trip, ctx);
    });

    return {
      items,
      meta: buildTripsMapMeta(items),
    };
  }

  private resolveMatchedRateDestinationFromBatch(
    trip: Trip,
    matchedByKey: Map<
      string,
      {
        destinationLatitude: string | number | null;
        destinationLongitude: string | number | null;
        postalCode: string;
        locality: string;
      }
    >,
  ): TripGeoResolverContext['matchedRateDestination'] {
    const rate = trip.destinationRate;
    if (
      this.hasGeoCoords(rate?.destinationLatitude, rate?.destinationLongitude)
    ) {
      return null;
    }

    const delivery = trip.client?.delivery;
    if (this.hasGeoCoords(delivery?.latitude, delivery?.longitude)) {
      return null;
    }

    const destinationPostalCode = trip.destinationPostalCode?.trim();
    const destinationLocality = trip.destinationLocality?.trim();
    if (!destinationPostalCode || !destinationLocality) {
      return null;
    }

    const key = `${destinationPostalCode.trim()}|${destinationLocality.trim().toLowerCase()}`;
    const matched =
      matchedByKey.get(key) ??
      matchedByKey.get(
        `${destinationPostalCode}|${destinationLocality.toLowerCase()}`,
      );
    if (
      !matched ||
      !this.hasGeoCoords(
        matched.destinationLatitude,
        matched.destinationLongitude,
      )
    ) {
      return null;
    }

    return {
      destinationLatitude:
        matched.destinationLatitude == null
          ? null
          : String(matched.destinationLatitude),
      destinationLongitude:
        matched.destinationLongitude == null
          ? null
          : String(matched.destinationLongitude),
      postalCode: matched.postalCode,
      locality: matched.locality,
    };
  }

  private hasGeoCoords(
    latitude: string | number | null | undefined,
    longitude: string | number | null | undefined,
  ): boolean {
    const lat =
      latitude == null || latitude === ''
        ? NaN
        : typeof latitude === 'number'
          ? latitude
          : Number(latitude);
    const lng =
      longitude == null || longitude === ''
        ? NaN
        : typeof longitude === 'number'
          ? longitude
          : Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  async findOne(companyId: number, tripId: number) {
    await this.tripLifecycle.ensureTripLifecycleFresh(companyId, tripId);

    const trip = await this.getTripEntity(companyId, tripId);
    const equipmentIds = [
      ...new Set((trip.tripEquipment ?? []).map((te) => te.equipmentId)),
    ];
    const [equipment, authorLookup] = await Promise.all([
      equipmentIds.length > 0
        ? this.equipmentRepo.find({
            where: { companyId, id: In(equipmentIds) },
            select: ['id', 'trailerBrandAbbr', 'trailerYear', 'plate'],
          })
        : Promise.resolve([]),
      this.loadAuthorLookup(companyId),
    ]);
    return mapTripToResponse(trip, equipment, authorLookup);
  }

  async findClientCargoHistory(
    companyId: number,
    clientIdRef: string,
  ): Promise<ClientCargoHistoryResponseDto> {
    const clientId = await this.resolveClientId(companyId, clientIdRef);
    if (!clientId) {
      return { items: [] };
    }

    const rows = await this.tripsRepo.find({
      where: { companyId, clientId, deletedAt: IsNull() },
      select: {
        cargoDescription: true,
        operationType: true,
        containerType: true,
        loadType: true,
        approximateWeightTons: true,
        createdAt: true,
      },
      order: { createdAt: 'DESC' },
    });

    const seen = new Set<string>();
    const items: ClientCargoHistoryResponseDto['items'] = [];

    for (const row of rows) {
      const raw = row.cargoDescription?.trim() ?? '';
      if (!raw) {
        continue;
      }
      const key = this.normalizeCargoDescription(raw);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({
        description: raw,
        operationType: row.operationType,
        containerType: row.containerType,
        loadType: row.loadType,
        approximateWeightTons: row.approximateWeightTons?.trim() ?? '',
      });
    }

    return { items };
  }

  async create(
    companyId: number,
    dto: CreateTripDto,
    rawBody: Record<string, unknown> = {},
  ) {
    rejectLegacyScheduleFields(rawBody);
    rejectClientTripStatusMutation(rawBody);
    rejectClientTripStatusMutation(dto as unknown as Record<string, unknown>);
    let planned;
    try {
      planned = parseRequiredPlannedScheduleFromCreateDto(dto);
    } catch (err) {
      if (
        err instanceof BadRequestException &&
        err.message === REQUIRED_PLANNED_SCHEDULE_MESSAGE
      ) {
        this.logInvalidCreateAttempt(companyId, dto);
      }
      throw err;
    }

    const seq = await this.nextManeuverSequence(companyId);
    const prefix = maneuverCodePrefixFromClientName(dto.clientName ?? '');
    const maneuverCode =
      dto.maneuverCode?.trim() || formatManeuverCode(prefix, seq);

    let clientId = dto.clientId
      ? await this.resolveClientId(companyId, dto.clientId)
      : undefined;
    if (!clientId && dto.clientName) {
      const client = await this.clientsRepo.findOne({
        where: { companyId, name: dto.clientName.trim() },
      });
      clientId = client?.id;
    }

    const defaultOriginCenter =
      await this.operationalCenters.getDefaultEntity(companyId);
    const originCenterId =
      parseOptionalNumericId(dto.originOperationalCenterId) ??
      defaultOriginCenter.id;
    const destinationRateId = await this.destinationRates.resolveRateIdForTrip(
      companyId,
      dto.destinationRateId,
      {
        originOperationalCenterId: originCenterId,
        destinationPostalCode: dto.destinationPostalCode,
        destinationLocality: dto.destinationLocality,
      },
    );
    let routeDistanceKm = dto.routeDistanceKm;
    if (destinationRateId != null && routeDistanceKm == null) {
      const matchedRate = await this.destinationRates.getRateEntity(
        companyId,
        destinationRateId,
      );
      if (matchedRate?.routeDistanceKm) {
        routeDistanceKm = Number(matchedRate.routeDistanceKm);
      }
    }
    const distanceFields = this.resolveDistanceFieldsForPersist(routeDistanceKm);

    const operationConfig = await this.resolveOperationConfig(
      companyId,
      dto.operationType,
    );

    const resolvedUnitId = dto.unitId
      ? await this.resolveUnitId(companyId, dto.unitId)
      : undefined;
    const resolvedOperatorId = dto.operatorId
      ? await this.resolveOperatorId(companyId, dto.operatorId)
      : undefined;

    await this.tripLoadPlaces.findOrCreate(companyId, dto.loadPlace);

    const initialStatus = 'scheduled';
    const createdAt = new Date();

    const entity = this.tripsRepo.create({
      companyId,
      maneuverCode,
      clientId,
      clientName: dto.clientName,
      unitId: resolvedUnitId,
      operatorId: resolvedOperatorId,
      status: initialStatus,
      plannedDepartureAt: planned.plannedDepartureAt,
      plannedArrivalAt: planned.plannedArrivalAt,
      plannedCompletionAt: planned.plannedCompletionAt,
      statusChangedAt: createdAt,
      statusChangedBy: 'system',
      operationType: operationConfig.code,
      operationConfigurationId: operationConfig.id,
      loadType: dto.loadType,
      containerType: dto.containerType,
      cargoDescription: dto.cargoDescription,
      approximateWeightTons: dto.approximateWeightTons,
      loadDate: dto.loadDate ? new Date(dto.loadDate) : undefined,
      loadPlace: dto.loadPlace?.trim() || undefined,
      creditDays: dto.creditDays ?? 0,
      routeDistanceKm: distanceFields?.routeDistanceKm,
      maneuverKind: dto.maneuverKind,
      dieselLiters: dto.dieselLiters,
      dieselAmount: dto.dieselAmount,
      casetasAmount: dto.casetasAmount,
      operatorQuota: dto.operatorQuota,
      perDiemAmount: dto.perDiemAmount,
      clientCharge: dto.clientCharge,
      paymentMethod: dto.paymentMethod,
      requiresInvoice: dto.requiresInvoice,
      originPostalCode: dto.originPostalCode,
      originCityMunicipality: dto.originCityMunicipality,
      originLocality: dto.originLocality,
      destinationPostalCode: dto.destinationPostalCode,
      destinationCityMunicipality: dto.destinationCityMunicipality,
      destinationLocality: dto.destinationLocality,
      destinationRateId,
      hasClientBilling: dto.hasClientBilling ?? !!dto.clientName?.trim(),
    });
    const equipmentIds = dto.equipmentIds?.length
      ? await this.resolveEquipmentIds(companyId, dto.equipmentIds)
      : [];

    const company = await this.companiesRepo.findOne({
      where: { id: companyId },
      select: [
        'id',
        'operationalAnalysisEnabled',
        'tripAutoMaintenanceProvisionPercent',
        'tripAutoFuelPaymentMethod',
        'tripAutoTollsPaymentMethod',
        'tripAutoPerDiemPaymentMethod',
        'tripAutoControlPaymentMethod',
      ],
    });

    // Maniobra + equipos enganchados + gastos automáticos en una sola
    // transacción: o queda todo registrado o no queda nada (antes se
    // compensaba a mano con un rollback manual que podía quedar a medias).
    const trip = await this.tripsRepo.manager.transaction(async (em) => {
      const saved = await em.getRepository(Trip).save(entity);

      if (equipmentIds.length) {
        await this.syncEquipment(saved.id, equipmentIds, em);
      }

      if (company?.operationalAnalysisEnabled !== false) {
        const rawPercent = company?.tripAutoMaintenanceProvisionPercent;
        const provisionPercent =
          rawPercent != null && rawPercent !== '' ? Number(rawPercent) : 5;
        const safePercent =
          Number.isFinite(provisionPercent) && provisionPercent >= 0
            ? provisionPercent
            : 5;
        try {
          await this.expensesService.createAutoExpensesForTrip(
            companyId,
            saved,
            {
              maintenanceProvisionPercent: safePercent,
              fuelPaymentMethod: company?.tripAutoFuelPaymentMethod,
              tollsPaymentMethod: company?.tripAutoTollsPaymentMethod,
              perDiemPaymentMethod: company?.tripAutoPerDiemPaymentMethod,
              controlPaymentMethod: company?.tripAutoControlPaymentMethod,
            },
            em,
          );
        } catch (err) {
          this.logger.error(
            `Auto expenses failed for trip ${saved.id} (company ${companyId})`,
            err instanceof Error ? err.stack : String(err),
          );
          throw new InternalServerErrorException(
            'No se pudo crear la maniobra: falló el registro de gastos automáticos.',
          );
        }
      }

      return saved;
    });

    await this.tripLifecycle.applyLifecycleChainForTrip(
      trip,
      new Date(),
      'system',
    );

    const tripForFleetSync = await this.getTripEntity(companyId, trip.id);
    await this.fleetStatusSync.syncForTrip(tripForFleetSync);

    return this.findOne(companyId, trip.id);
  }

  async update(
    companyId: number,
    tripId: number,
    dto: UpdateTripDto,
    rawBody: Record<string, unknown> = {},
    actor?: AuthUser,
  ) {
    rejectLegacyScheduleFields(rawBody);
    rejectClientTripStatusMutation(rawBody);
    rejectClientTripStatusMutation(dto as unknown as Record<string, unknown>);
    assertNoSnapshotMutation(rawBody);
    assertNoSnapshotMutationDto(dto);
    const trip = await this.getTripEntity(companyId, tripId);
    const previousUnitId = trip.unitId ?? null;
    const previousOperatorId = trip.operatorId ?? null;
    const previousEquipmentIds = (trip.tripEquipment ?? []).map(
      (row) => row.equipmentId,
    );
    const {
      equipmentIds,
      plannedDepartureAt,
      plannedArrivalAt,
      plannedCompletionAt,
      clientId,
      unitId,
      operatorId,
      operationType,
      departureAt: _ignoredDepartureAt,
      arrivedAt: _ignoredArrivedAt,
      returnAt: _ignoredReturnAt,
      loadDate,
      loadPlace,
      emptyDeliveryAt,
      emptyDeliveryPlace,
      emptyDeliveryJustification,
      plannedDatesJustification,
      ...rest
    } = dto;
    const hasPlannedDatesPatch = [
      plannedDepartureAt,
      plannedArrivalAt,
      plannedCompletionAt,
      loadDate,
      loadPlace,
    ].some((value) => value !== undefined);
    this.assertScheduledDatesAreEditable(
      trip,
      {
        plannedDepartureAt,
        plannedArrivalAt,
        plannedCompletionAt,
        loadDate,
        loadPlace,
      },
      plannedDatesJustification,
    );
    this.assertEmptyDeliveryAllowed(
      trip,
      emptyDeliveryAt,
      emptyDeliveryPlace,
      emptyDeliveryJustification,
    );
    const plannedPatch = validatePlannedScheduleUpdate(trip, {
      plannedDepartureAt,
      plannedArrivalAt,
      plannedCompletionAt,
    });
    const operationPatch =
      operationType !== undefined
        ? await this.resolveOperationConfig(companyId, operationType)
        : null;

    let resolvedUnitIdForPatch: number | undefined | null = undefined;
    let resolvedOperatorIdForPatch: number | undefined | null = undefined;

    if (unitId !== undefined) {
      resolvedUnitIdForPatch = unitId
        ? await this.resolveUnitId(companyId, unitId, tripId)
        : undefined;
    }

    if (operatorId !== undefined) {
      resolvedOperatorIdForPatch = operatorId
        ? await this.resolveOperatorId(companyId, operatorId, tripId)
        : undefined;
    }

    const emptyDeliveryAtDate = this.validateEmptyDeliveryAt(
      trip,
      plannedPatch.plannedCompletionAt,
      emptyDeliveryAt,
    );

    await this.tripLoadPlaces.findOrCreate(companyId, loadPlace);
    await this.tripLoadPlaces.findOrCreate(companyId, emptyDeliveryPlace);

    await this.tripsRepo.update(
      { id: tripId, companyId },
      {
        ...rest,
        ...(loadDate !== undefined
          ? { loadDate: loadDate ? new Date(loadDate) : undefined }
          : {}),
        ...(loadPlace !== undefined
          ? { loadPlace: loadPlace?.trim() || undefined }
          : {}),
        ...(emptyDeliveryAt !== undefined
          ? { emptyDeliveryAt: emptyDeliveryAtDate }
          : {}),
        ...(emptyDeliveryPlace !== undefined
          ? { emptyDeliveryPlace: emptyDeliveryPlace?.trim() || undefined }
          : {}),
        ...(operationPatch && {
          operationType: operationPatch.code,
          operationConfigurationId: operationPatch.id,
        }),
        ...(plannedPatch.plannedDepartureAt && {
          plannedDepartureAt: plannedPatch.plannedDepartureAt,
        }),
        ...(plannedPatch.plannedArrivalAt && {
          plannedArrivalAt: plannedPatch.plannedArrivalAt,
        }),
        ...(plannedPatch.plannedCompletionAt && {
          plannedCompletionAt: plannedPatch.plannedCompletionAt,
        }),
        ...(clientId !== undefined && {
          clientId: clientId
            ? await this.resolveClientId(companyId, clientId)
            : undefined,
        }),
        ...(unitId !== undefined && { unitId: resolvedUnitIdForPatch }),
        ...(operatorId !== undefined && {
          operatorId: resolvedOperatorIdForPatch,
        }),
      },
    );
    if (equipmentIds) {
      const resolvedEquipmentIds = await this.resolveEquipmentIds(
        companyId,
        equipmentIds,
        tripId,
      );
      await this.syncEquipment(tripId, resolvedEquipmentIds);
    }

    const resourceAssignmentChanged =
      unitId !== undefined ||
      operatorId !== undefined ||
      equipmentIds !== undefined;

    const updatedTrip = await this.getTripEntity(companyId, tripId);
    if (resourceAssignmentChanged) {
      const releasedUnitIds: number[] = [];
      const releasedOperatorIds: number[] = [];
      const releasedEquipmentIds: number[] = [];

      if (
        unitId !== undefined &&
        previousUnitId != null &&
        previousUnitId !== updatedTrip.unitId
      ) {
        releasedUnitIds.push(previousUnitId);
      }
      if (
        operatorId !== undefined &&
        previousOperatorId != null &&
        previousOperatorId !== updatedTrip.operatorId
      ) {
        releasedOperatorIds.push(previousOperatorId);
      }
      if (equipmentIds !== undefined) {
        const currentEquipmentIdSet = new Set(
          (updatedTrip.tripEquipment ?? []).map((row) => row.equipmentId),
        );
        for (const equipmentId of previousEquipmentIds) {
          if (!currentEquipmentIdSet.has(equipmentId)) {
            releasedEquipmentIds.push(equipmentId);
          }
        }
      }

      await this.fleetStatusSync.syncForTripAfterUpdate(
        {
          id: updatedTrip.id,
          companyId: updatedTrip.companyId,
          status: updatedTrip.status,
          unitId: updatedTrip.unitId,
          operatorId: updatedTrip.operatorId,
        },
        {
          unitIds: releasedUnitIds,
          operatorIds: releasedOperatorIds,
          equipmentIds: releasedEquipmentIds,
        },
      );
    } else {
      await this.fleetStatusSync.syncForTrip({
        id: updatedTrip.id,
        companyId: updatedTrip.companyId,
        status: updatedTrip.status,
        unitId: updatedTrip.unitId,
        operatorId: updatedTrip.operatorId,
      });
    }

    const updatedTripEntity = await this.getTripEntity(companyId, tripId);
    if (hasPlannedDatesPatch) {
      const authorDisplayName =
        actor?.name?.trim() || actor?.username?.trim() || 'Usuario';
      await this.incidentsRepo.save(
        this.incidentsRepo.create({
          tripId: trip.id,
          description:
            `Fechas programadas actualizadas por ${authorDisplayName}. ` +
            `Salida: ${updatedTripEntity.plannedDepartureAt.toLocaleString('es-MX')}. ` +
            `Llegada cliente: ${updatedTripEntity.plannedArrivalAt.toLocaleString('es-MX')}. ` +
            `Fin: ${updatedTripEntity.plannedCompletionAt.toLocaleString('es-MX')}. ` +
            `Fecha de carga: ${updatedTripEntity.loadDate?.toLocaleString('es-MX') ?? '—'}. ` +
            `Lugar de carga: ${updatedTripEntity.loadPlace?.trim() || '—'}. ` +
            `Justificación: ${plannedDatesJustification!.trim()}`,
          postedBy: actor?.username?.trim() || 'system',
          isIncident: false,
        }),
      );
    }
    if (
      trip.emptyDeliveryAt &&
      (emptyDeliveryAt !== undefined || emptyDeliveryPlace !== undefined)
    ) {
      const authorDisplayName =
        actor?.name?.trim() || actor?.username?.trim() || 'Usuario';
      const nextDate = emptyDeliveryAt
        ? new Date(emptyDeliveryAt).toLocaleString('es-MX')
        : trip.emptyDeliveryAt.toLocaleString('es-MX');
      const nextPlace =
        emptyDeliveryPlace?.trim() || trip.emptyDeliveryPlace?.trim() || '—';
      await this.incidentsRepo.save(
        this.incidentsRepo.create({
          tripId: trip.id,
          description:
            `Entrega de vacío actualizada por ${authorDisplayName}. ` +
            `Nueva fecha: ${nextDate}. Lugar: ${nextPlace}. ` +
            `Justificación: ${emptyDeliveryJustification!.trim()}`,
          postedBy: actor?.username?.trim() || 'system',
          isIncident: false,
        }),
      );
    }
    await this.activityEvents.record({
      companyId,
      kind: COMPANY_ACTIVITY_KIND.TRIP_UPDATED,
      entityType: 'trip',
      entityId: tripId,
      subjectLabel: updatedTripEntity.maneuverCode?.trim() || `M-${tripId}`,
      title: 'Maniobra modificada',
      actor,
    });

    return this.findOne(companyId, tripId);
  }

  async cancel(companyId: number, tripId: number, dto: CancelTripDto) {
    const trip = await this.getTripEntity(companyId, tripId);
    const note = dto.note?.trim() ?? '';
    if (dto.falseManeuver && !note) {
      throw new BadRequestException(
        'La maniobra en falso requiere un detalle o explicación breve.',
      );
    }
    if (trip.status === 'completed') {
      throw new BadRequestException(
        'No se puede cancelar una maniobra ya completada.',
      );
    }
    await this.tripsRepo.update(
      { id: trip.id, companyId },
      {
        status: 'cancelled',
        falseManeuver: dto.falseManeuver || undefined,
        cancellationNote: note || undefined,
      },
    );
    await this.fleetStatusSync.syncForTrip({
      id: trip.id,
      companyId: trip.companyId,
      status: 'cancelled',
      unitId: trip.unitId,
      operatorId: trip.operatorId,
    });
    return this.findOne(companyId, tripId);
  }

  async addIncident(
    companyId: number,
    tripId: number,
    dto: AddIncidentDto,
    actor?: AuthUser,
  ) {
    if (actor) {
      assertTripBitacoraAccess(actor, dto.isIncident === true);
    }
    const trip = await this.getTripEntity(companyId, tripId);
    const isIncident = dto.isIncident === true;
    const savedIncident = await this.incidentsRepo.save(
      this.incidentsRepo.create({
        tripId: trip.id,
        description: dto.description.trim(),
        postedBy: dto.postedBy.trim(),
        isIncident,
      }),
    );
    await syncTripIncidentMarkers(
      this.tripsRepo,
      this.incidentsRepo,
      trip.id,
      companyId,
    );
    await this.activityEvents.record({
      companyId,
      kind: isIncident
        ? COMPANY_ACTIVITY_KIND.INCIDENT_REPORTED
        : COMPANY_ACTIVITY_KIND.BITACORA_MESSAGE,
      entityType: 'trip',
      entityId: trip.id,
      subjectLabel: trip.maneuverCode?.trim() || `M-${trip.id}`,
      title: isIncident ? 'Incidente reportado' : 'Nuevo mensaje en bitácora',
      actor,
      metadata: { incidentId: savedIncident.id },
    });
    return this.findOne(companyId, tripId);
  }

  async updateActualSchedule(
    companyId: number,
    tripId: number,
    dto: UpdateActualScheduleDto,
    rawBody: Record<string, unknown>,
    user: AuthUser,
  ) {
    rejectDisallowedActualScheduleBodyKeys(rawBody);
    const trip = await this.getTripEntity(companyId, tripId);

    if (trip.status !== 'in_transit') {
      throw new BadRequestException(
        'Solo maniobras en curso pueden actualizar fechas reales.',
      );
    }

    const hasAnyDateField =
      dto.departureAt !== undefined ||
      dto.arrivedAt !== undefined ||
      dto.returnAt !== undefined;

    if (!hasAnyDateField) {
      throw new BadRequestException(
        'Indica al menos una fecha real para actualizar.',
      );
    }

    const incoming: Partial<Record<ActualScheduleFieldKey, Date>> = {};
    if (dto.departureAt !== undefined) {
      incoming.departureAt = parseOptionalIsoDate(
        dto.departureAt,
        'departureAt',
      )!;
    }
    if (dto.arrivedAt !== undefined) {
      incoming.arrivedAt = parseOptionalIsoDate(dto.arrivedAt, 'arrivedAt')!;
    }
    if (dto.returnAt !== undefined) {
      incoming.returnAt = parseOptionalIsoDate(dto.returnAt, 'returnAt')!;
    }

    const current = {
      departureAt: trip.departureAt ?? null,
      arrivedAt: trip.arrivedAt ?? null,
      returnAt: trip.returnAt ?? null,
    };

    const deltas = detectActualScheduleDeltas(current, incoming);
    if (deltas.length === 0) {
      throw new BadRequestException('No hay cambios en fechas reales.');
    }

    if (
      trip.status === 'in_transit' &&
      deltas.some((delta) => delta.field === 'departureAt')
    ) {
      throw new BadRequestException(
        'No se puede modificar la salida real en maniobras en curso.',
      );
    }

    const justification = dto.justification?.trim() ?? '';
    if (!justification) {
      throw new BadRequestException(
        'La justificación es obligatoria cuando se modifican fechas reales.',
      );
    }

    const nextValues = applyActualScheduleDeltas(current, deltas);
    assertActualScheduleChronology(nextValues, {
      plannedDepartureAt: trip.plannedDepartureAt,
      plannedArrivalAt: trip.plannedArrivalAt,
      plannedCompletionAt: trip.plannedCompletionAt,
    });

    const patch: Partial<
      Pick<typeof trip, 'departureAt' | 'arrivedAt' | 'returnAt'>
    > = {};
    for (const delta of deltas) {
      patch[delta.field] = delta.next;
    }

    await this.tripsRepo.update({ id: trip.id, companyId }, patch);

    const updatedAt = new Date();
    const authorDisplayName =
      user.name?.trim() || user.username?.trim() || 'Usuario';
    await this.incidentsRepo.save(
      this.incidentsRepo.create({
        tripId: trip.id,
        description: buildConsolidatedScheduleUpdateIncidentDescription({
          deltas,
          planned: {
            plannedDepartureAt: trip.plannedDepartureAt,
            plannedArrivalAt: trip.plannedArrivalAt,
            plannedCompletionAt: trip.plannedCompletionAt,
          },
          justification,
          authorDisplayName,
        }),
        postedBy: user.username.trim(),
        isIncident: false,
      }),
    );

    const reloaded = await this.getTripEntity(companyId, tripId);
    await this.tripLifecycle.applyLifecycleChainForTrip(
      reloaded,
      updatedAt,
      'system',
    );

    return this.findOne(companyId, tripId);
  }

  async setClientCollected(
    companyId: number,
    tripId: number,
    collected: boolean,
    actor?: AuthUser,
  ) {
    const trip = await this.getTripEntity(companyId, tripId);
    if (trip.hasClientBilling === false) {
      throw new BadRequestException(
        'Esta maniobra no tiene cobro a cliente registrado.',
      );
    }
    if (trip.status !== 'completed' && trip.status !== 'cancelled') {
      throw new BadRequestException(
        'Solo maniobras completadas o canceladas pueden marcarse como cobradas.',
      );
    }
    if ((trip.clientCollectedAt != null) === collected) {
      return this.findOne(companyId, tripId);
    }
    await this.tripsRepo.update(
      { id: trip.id, companyId },
      {
        clientCollectedAt: collected ? new Date() : null,
      },
    );
    const maneuverRef = trip.maneuverCode?.trim() || `#${trip.id}`;
    const clientLabel = trip.clientName?.trim() || 'Cliente';
    await this.activityEvents.record({
      companyId,
      kind: collected
        ? COMPANY_ACTIVITY_KIND.PAYMENT_CONFIRMED
        : COMPANY_ACTIVITY_KIND.PAYMENT_REVERTED,
      entityType: 'trip',
      entityId: trip.id,
      subjectLabel: `${clientLabel} · maniobra ${maneuverRef}`,
      title: collected
        ? 'Cobro a cliente confirmado'
        : 'Confirmación de cobro a cliente removida',
      actor,
      metadata: {
        tripId: trip.id,
        clientId: trip.clientId,
        amount: Number(trip.clientCharge ?? 0),
        collected,
      },
    });
    return this.findOne(companyId, tripId);
  }

  async softDelete(companyId: number, tripId: number, actor: AuthUser) {
    this.assertAdmin(actor);
    const trip = await this.getTripEntity(companyId, tripId, {
      includeDeleted: true,
    });
    if (trip.deletedAt) {
      throw new BadRequestException('La maniobra ya fue eliminada.');
    }

    const equipmentIds = (trip.tripEquipment ?? []).map(
      (row) => row.equipmentId,
    );
    const activeFleetStatuses = new Set(['scheduled', 'in_transit']);
    const releasesFleet = activeFleetStatuses.has(trip.status);
    const wasCompleted = trip.status === 'completed';

    const deletedAt = new Date();
    const deletedBy =
      actor.name?.trim() ||
      actor.username?.trim() ||
      actor.role?.trim() ||
      'admin';

    // Descartar gastos, revertir odómetro y marcar la eliminación son un
    // todo-o-nada: sin transacción un fallo intermedio dejaría cabos sueltos.
    const discardedExpenses = await this.tripsRepo.manager.transaction(
      async (em) => {
        const discarded = await this.expensesService.discardByTripId(
          companyId,
          trip.id,
          em,
        );

        if (wasCompleted) {
          await this.unitTripOdometer.reverseCreditForTrip(trip, em);
        }

        // Sin rastro en el feed de notificaciones/actividad.
        await this.activityEvents.purgeForTrip(companyId, trip.id, em);

        await em.getRepository(Trip).update(
          { id: trip.id, companyId },
          {
            deletedAt,
            deletedBy,
            ...(releasesFleet ? { status: 'cancelled' } : {}),
          },
        );
        return discarded;
      },
    );

    await this.fleetStatusSync.reconcileReleasedFleetResources(companyId, {
      unitIds: trip.unitId != null ? [trip.unitId] : [],
      operatorIds: trip.operatorId != null ? [trip.operatorId] : [],
      equipmentIds,
    });

    this.logger.warn({
      event_type: 'trip.soft_deleted',
      companyId,
      tripId: trip.id,
      maneuverCode: trip.maneuverCode,
      previousStatus: trip.status,
      discardedExpenses,
      deletedBy,
    });

    return {
      id: tripId,
      deleted: true,
      deletedAt: deletedAt.toISOString(),
      discardedExpenses,
    };
  }

  private logInvalidCreateAttempt(companyId: number, dto: CreateTripDto): void {
    this.logger.warn({
      event_type: 'trip.invalid_create_attempt',
      reason: MISSING_PLANNED_FIELDS_REASON,
      companyId,
      clientName: dto.clientName,
      originLocality: dto.originLocality,
      destinationLocality: dto.destinationLocality,
      hasPlannedDepartureAt: Boolean(dto.plannedDepartureAt?.trim()),
      hasPlannedArrivalAt: Boolean(dto.plannedArrivalAt?.trim()),
      hasPlannedCompletionAt: Boolean(dto.plannedCompletionAt?.trim()),
    });
  }

  private assertAdmin(actor: AuthUser): void {
    if (!isAdminRole(actor.role)) {
      throw new ForbiddenException(
        'Solo administradores pueden eliminar maniobras.',
      );
    }
  }

  /** Fechas planeadas y datos de carga se congelan al comenzar la maniobra. */
  private assertScheduledDatesAreEditable(
    trip: Trip,
    patch: {
      plannedDepartureAt?: string;
      plannedArrivalAt?: string;
      plannedCompletionAt?: string;
      loadDate?: string;
      loadPlace?: string;
    },
    justification: string | undefined,
  ): void {
    const hasDatePatch = Object.values(patch).some(
      (value) => value !== undefined,
    );
    if (hasDatePatch && trip.status !== 'scheduled') {
      throw new BadRequestException(
        'Las fechas planeadas y los datos de carga solo pueden editarse mientras la maniobra está programada.',
      );
    }
    if (hasDatePatch && !justification?.trim()) {
      throw new BadRequestException(
        'La justificación es obligatoria al actualizar las fechas programadas.',
      );
    }
  }

  /** Entrega de vacío solo aplica en curso/completada y con contenedor real. */
  private assertEmptyDeliveryAllowed(
    trip: Trip,
    emptyDeliveryAt: string | undefined,
    emptyDeliveryPlace: string | undefined,
    justification: string | undefined,
  ): void {
    if (emptyDeliveryAt === undefined && emptyDeliveryPlace === undefined) {
      return;
    }
    if (trip.status !== 'in_transit' && trip.status !== 'completed') {
      throw new BadRequestException(
        'La entrega de vacío solo puede registrarse cuando la maniobra está en curso o completada.',
      );
    }
    const containerType = trip.containerType
      ?.trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (
      !containerType ||
      containerType === 'na' ||
      containerType === 'n/a' ||
      containerType === 'no aplica'
    ) {
      throw new BadRequestException(
        'La entrega de vacío solo aplica a maniobras con contenedor.',
      );
    }
    if (!emptyDeliveryAt?.trim() || !emptyDeliveryPlace?.trim()) {
      throw new BadRequestException(
        'La fecha y el lugar de entrega de vacío son obligatorios.',
      );
    }
    if (trip.emptyDeliveryAt && !justification?.trim()) {
      throw new BadRequestException(
        'La justificación es obligatoria al actualizar una entrega de vacío.',
      );
    }
  }

  /**
   * Entrega de vacío: la fecha nunca puede ser menor al fin planeado ni al
   * fin real de la maniobra. Devuelve la fecha lista para persistir.
   */
  private validateEmptyDeliveryAt(
    trip: Trip,
    patchedPlannedCompletionAt: Date | undefined,
    emptyDeliveryAt: string | undefined,
  ): Date | undefined {
    if (!emptyDeliveryAt) {
      return undefined;
    }
    const value = new Date(emptyDeliveryAt);
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestException(
        'La fecha de entrega de vacío no es válida.',
      );
    }
    const plannedCompletion =
      patchedPlannedCompletionAt ?? trip.plannedCompletionAt;
    if (
      plannedCompletion &&
      value.getTime() < new Date(plannedCompletion).getTime()
    ) {
      throw new BadRequestException(
        'La entrega de vacío no puede ser anterior al fin planeado de la maniobra.',
      );
    }
    if (trip.returnAt && value.getTime() < new Date(trip.returnAt).getTime()) {
      throw new BadRequestException(
        'La entrega de vacío no puede ser anterior al fin real de la maniobra.',
      );
    }
    return value;
  }

  private async getTripEntity(
    companyId: number,
    tripId: number,
    opts?: { includeDeleted?: boolean },
  ) {
    const trip = await this.tripsRepo.findOne({
      where: { companyId, id: tripId },
      relations: [...this.tripRelations],
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    if (!opts?.includeDeleted && trip.deletedAt) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    return trip;
  }

  private async loadAuthorLookup(
    companyId: number,
  ): Promise<IncidentAuthorLookup> {
    const users = await this.usersRepo.find({
      where: { companyId },
      select: ['username', 'displayName', 'jobTitle', 'role'],
    });
    return buildIncidentAuthorLookup(users);
  }

  private async nextManeuverSequence(companyId: number): Promise<number> {
    // Solo maniobras vivas: el folio de una eliminada queda liberado.
    const rows = await this.tripsRepo.find({
      where: { companyId, deletedAt: IsNull() },
      select: ['maneuverCode'],
    });
    let max = 0;
    for (const row of rows) {
      const match = /-(\d+)$/.exec(row.maneuverCode);
      if (match) {
        max = Math.max(max, Number(match[1]));
      }
    }
    return max + 1;
  }

  private async syncEquipment(
    tripId: number,
    equipmentIds: number[],
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(TripEquipment)
      : this.tripEquipmentRepo;
    await repo.delete({ tripId });
    const rows = equipmentIds.slice(0, 2).map((equipmentId, index) =>
      repo.create({
        tripId,
        equipmentId,
        position: index + 1,
      }),
    );
    if (rows.length) {
      await repo.save(rows);
    }
  }

  private normalizeCargoDescription(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private async resolveClientId(
    companyId: number,
    ref: string,
  ): Promise<number | undefined> {
    const clientId = parseOptionalNumericId(ref, 'Client');
    if (!clientId) {
      return undefined;
    }
    const row = await this.clientsRepo.findOne({
      where: { companyId, id: clientId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return row.id;
  }

  private async resolveUnitId(
    companyId: number,
    ref: string,
    excludeTripId?: number,
  ): Promise<number | undefined> {
    const unitId = parseOptionalNumericId(ref, 'Unit');
    if (!unitId) {
      return undefined;
    }
    const row = await this.unitsRepo.findOne({
      where: { companyId, id: unitId },
      select: ['id', 'isActive', 'status'],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    assertFleetResourceAssignableForTrip(row, 'Unit');
    await assertResourceNotOnActiveTrip(
      this.tripsRepo,
      this.tripEquipmentRepo,
      companyId,
      'unit',
      row.id,
      'Unit',
      excludeTripId,
    );
    return row.id;
  }

  private async resolveOperatorId(
    companyId: number,
    ref: string,
    excludeTripId?: number,
  ): Promise<number | undefined> {
    const operatorId = parseOptionalNumericId(ref, 'Operator');
    if (!operatorId) {
      return undefined;
    }
    const row = await this.operatorsRepo.findOne({
      where: { companyId, id: operatorId },
      select: ['id', 'isActive', 'status'],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    assertFleetResourceAssignableForTrip(row, 'Operator');
    await assertResourceNotOnActiveTrip(
      this.tripsRepo,
      this.tripEquipmentRepo,
      companyId,
      'operator',
      row.id,
      'Operator',
      excludeTripId,
    );
    return row.id;
  }

  private async resolveOperationConfig(
    companyId: number,
    rawCode: string,
  ): Promise<{
    code: string;
    id?: number;
  }> {
    const code =
      normalizeOperationConfigCode(rawCode) || rawCode.trim().toLowerCase();
    if (!code) {
      return { code: '' };
    }
    const config = await this.operationConfigurations.findByCode(
      companyId,
      code,
    );
    if (config) {
      return {
        code: config.code,
        id: config.id,
      };
    }
    return { code };
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

  private async resolveEquipmentIds(
    companyId: number,
    refs: string[],
    excludeTripId?: number,
  ): Promise<number[]> {
    const out: number[] = [];
    for (const ref of refs) {
      const equipmentId = parseOptionalNumericId(ref, 'Equipment');
      if (!equipmentId) {
        continue;
      }
      const row = await this.equipmentRepo.findOne({
        where: { companyId, id: equipmentId },
        select: ['id', 'isActive', 'status'],
      });
      if (row) {
        assertFleetResourceAssignableForTrip(row, 'Equipment');
        await assertResourceNotOnActiveTrip(
          this.tripsRepo,
          this.tripEquipmentRepo,
          companyId,
          'equipment',
          row.id,
          'Equipment',
          excludeTripId,
        );
        out.push(row.id);
      }
    }
    return out;
  }
}
