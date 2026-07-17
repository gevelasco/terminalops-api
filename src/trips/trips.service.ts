import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, type EntityManager } from 'typeorm';
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
import { FuelPriceService } from 'src/fuel/fuel-price.service';
import { DestinationRatesService } from 'src/destination-rates/destination-rates.service';
import { OperationalCentersService } from 'src/operational-centers/operational-centers.service';
import { OperationConfigurationsService } from 'src/operation-configurations/operation-configurations.service';
import { buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';
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
import { SCHEDULE_UPDATE_INCIDENT_CATEGORY } from './actual-schedule/actual-schedule.constants';
import type { ActualScheduleFieldKey } from './actual-schedule/actual-schedule.constants';
import { buildConsolidatedScheduleUpdateIncidentDescription } from './actual-schedule/actual-schedule-incident.util';
import { syncTripIncidentMarkers } from './trip-incident-markers.util';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
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
    private readonly fuelPriceService: FuelPriceService,
    private readonly operationConfigurations: OperationConfigurationsService,
    private readonly destinationRates: DestinationRatesService,
    private readonly operationalCenters: OperationalCentersService,
    private readonly tripLifecycle: TripLifecycleService,
    private readonly fleetStatusSync: TripFleetStatusSyncService,
    private readonly unitTripOdometer: UnitTripOdometerService,
    private readonly expensesService: ExpensesService,
    private readonly activityEvents: ActivityEventsService,
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

    const [trips, equipment, authorLookup] = await Promise.all([
      rowsQb.getMany(),
      this.equipmentRepo.find({ where: { companyId } }),
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

    const items = await Promise.all(
      trips.map(async (trip) => {
        const matchedRateDestination =
          await this.resolveMatchedRateDestinationForMap(
            companyId,
            trip,
            defaultCenter.id,
          );
        const ctx: TripGeoResolverContext = {
          defaultCenter,
          operationalCenters,
          matchedRateDestination,
        };
        return mapTripToMapItem(trip, ctx);
      }),
    );

    return {
      items,
      meta: buildTripsMapMeta(items),
    };
  }

  private async resolveMatchedRateDestinationForMap(
    companyId: number,
    trip: Trip,
    defaultCenterId: number,
  ): Promise<TripGeoResolverContext['matchedRateDestination']> {
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

    const matched = await this.destinationRates.findMatchingRate(companyId, {
      originOperationalCenterId: defaultCenterId,
      destinationPostalCode,
      destinationLocality,
    });
    if (!matched) {
      return null;
    }

    return {
      destinationLatitude: matched.destinationLatitude,
      destinationLongitude: matched.destinationLongitude,
      originLatitude: matched.originLatitude,
      originLongitude: matched.originLongitude,
      postalCode: matched.postalCode,
      locality: matched.locality,
      cityMunicipality: matched.cityMunicipality,
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

    const [trip, equipment, authorLookup] = await Promise.all([
      this.getTripEntity(companyId, tripId),
      this.equipmentRepo.find({ where: { companyId } }),
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

    const isRoundTrip = dto.isRoundTrip !== false;
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
    const distanceFields = this.resolveDistanceFieldsForPersist(
      routeDistanceKm,
      isRoundTrip,
    );

    const dieselPricePerLiterAtCreation =
      await this.resolveDieselPriceSnapshot(dto);

    const operationSnapshot = await this.resolveOperationConfigSnapshot(
      companyId,
      dto.operationType,
    );

    const resolvedUnitId = dto.unitId
      ? await this.resolveUnitId(companyId, dto.unitId)
      : undefined;
    const resolvedOperatorId = dto.operatorId
      ? await this.resolveOperatorId(companyId, dto.operatorId)
      : undefined;

    const [unitRow, operatorRow] = await Promise.all([
      resolvedUnitId
        ? this.unitsRepo.findOne({ where: { id: resolvedUnitId, companyId } })
        : Promise.resolve(null),
      resolvedOperatorId
        ? this.operatorsRepo.findOne({
            where: { id: resolvedOperatorId, companyId },
          })
        : Promise.resolve(null),
    ]);

    const initialStatus = 'scheduled';
    const createdAt = new Date();

    const entity = this.tripsRepo.create({
      companyId,
      maneuverCode,
      origin: dto.origin,
      destination: dto.destination,
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
      isDelayed: false,
      openIncidentCount: 0,
      operationType: operationSnapshot.code,
      operationConfigurationId: operationSnapshot.id,
      operationConfigurationNameSnapshot: operationSnapshot.nameSnapshot,
      operationConfigurationVersionSnapshot: operationSnapshot.versionSnapshot,
      operationConfigurationMaxEquipmentCountSnapshot:
        operationSnapshot.maxEquipmentCountSnapshot,
      loadType: dto.loadType,
      containerType: dto.containerType,
      cargoDescription: dto.cargoDescription,
      approximateWeightTons: dto.approximateWeightTons,
      creditDays: dto.creditDays ?? 0,
      routeDistanceKm: distanceFields?.routeDistanceKm,
      operationalDistanceKm: distanceFields?.operationalDistanceKm,
      isRoundTrip,
      maneuverKind: dto.maneuverKind,
      dieselLiters: dto.dieselLiters,
      dieselAmount: dto.dieselAmount,
      dieselPricePerLiterAtCreation,
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
      operatorLicenseNumber: dto.operatorLicenseNumber,
      operatorLicenseExpiresLabel: dto.operatorLicenseExpiresLabel,
      operatorNameSnapshot: operatorRow?.name?.trim() || undefined,
      unitOperationalCodeSnapshot: unitRow
        ? buildUnitOperationalId(unitRow)
        : undefined,
      tollCalculationMode: dto.tollCalculationMode,
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
      isRoundTrip,
      clientId,
      unitId,
      operatorId,
      operationType,
      departureAt: _ignoredDepartureAt,
      arrivedAt: _ignoredArrivedAt,
      returnAt: _ignoredReturnAt,
      dieselPricePerLiterAtCreation: _immutablePrice,
      tollCalculationMode: _immutableTollMode,
      ...rest
    } = dto;
    const plannedPatch = validatePlannedScheduleUpdate(trip, {
      plannedDepartureAt,
      plannedArrivalAt,
      plannedCompletionAt,
    });
    const operationPatch =
      operationType !== undefined
        ? await this.resolveOperationConfigSnapshot(companyId, operationType)
        : null;

    let resolvedUnitIdForPatch: number | undefined | null = undefined;
    let resolvedOperatorIdForPatch: number | undefined | null = undefined;
    const assignmentSnapshotPatch: {
      unitOperationalCodeSnapshot?: string;
      operatorNameSnapshot?: string;
    } = {};

    if (unitId !== undefined) {
      resolvedUnitIdForPatch = unitId
        ? await this.resolveUnitId(companyId, unitId, tripId)
        : undefined;
      const unitRow = resolvedUnitIdForPatch
        ? await this.unitsRepo.findOne({
            where: { id: resolvedUnitIdForPatch, companyId },
          })
        : null;
      assignmentSnapshotPatch.unitOperationalCodeSnapshot = unitRow
        ? buildUnitOperationalId(unitRow)
        : undefined;
    }

    if (operatorId !== undefined) {
      resolvedOperatorIdForPatch = operatorId
        ? await this.resolveOperatorId(companyId, operatorId, tripId)
        : undefined;
      const operatorRow = resolvedOperatorIdForPatch
        ? await this.operatorsRepo.findOne({
            where: { id: resolvedOperatorIdForPatch, companyId },
          })
        : null;
      assignmentSnapshotPatch.operatorNameSnapshot =
        operatorRow?.name?.trim() || undefined;
    }

    await this.tripsRepo.update(
      { id: tripId, companyId },
      {
        ...rest,
        ...(operationPatch && {
          operationType: operationPatch.code,
          operationConfigurationId: operationPatch.id,
          operationConfigurationNameSnapshot: operationPatch.nameSnapshot,
          operationConfigurationVersionSnapshot: operationPatch.versionSnapshot,
          operationConfigurationMaxEquipmentCountSnapshot:
            operationPatch.maxEquipmentCountSnapshot,
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
        ...(isRoundTrip !== undefined && {
          isRoundTrip: isRoundTrip !== false,
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
        ...(unitId !== undefined && {
          unitOperationalCodeSnapshot:
            assignmentSnapshotPatch.unitOperationalCodeSnapshot,
        }),
        ...(operatorId !== undefined && {
          operatorNameSnapshot: assignmentSnapshotPatch.operatorNameSnapshot,
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
    const openedAt = new Date();
    const isIncident = dto.isIncident === true;
    const savedIncident = await this.incidentsRepo.save(
      this.incidentsRepo.create({
        tripId: trip.id,
        description: dto.description.trim(),
        postedBy: dto.postedBy.trim(),
        occurredAt: openedAt,
        status: 'closed',
        openedAt,
        closedAt: openedAt,
        category: dto.category?.trim() || (isIncident ? 'other' : 'bitacora'),
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

    const openedAt = new Date();
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
        occurredAt: openedAt,
        status: 'closed',
        openedAt,
        closedAt: openedAt,
        category: SCHEDULE_UPDATE_INCIDENT_CATEGORY,
        isIncident: false,
      }),
    );

    await this.tripLifecycle.refreshDelayMetricsForTrip(trip.id, openedAt);

    const reloaded = await this.getTripEntity(companyId, tripId);
    await this.tripLifecycle.applyLifecycleChainForTrip(
      reloaded,
      openedAt,
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
      origin: dto.origin,
      destination: dto.destination,
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
    const [users, operators] = await Promise.all([
      this.usersRepo.find({
        where: { companyId },
        select: ['username', 'displayName', 'jobTitle', 'role'],
      }),
      this.operatorsRepo.find({
        where: { companyId },
        select: ['name', 'portalUsername'],
      }),
    ]);
    return buildIncidentAuthorLookup(users, operators);
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

  private async resolveOperationConfigSnapshot(
    companyId: number,
    rawCode: string,
  ): Promise<{
    code: string;
    id?: number;
    nameSnapshot: string;
    versionSnapshot: number;
    maxEquipmentCountSnapshot: number;
  }> {
    const code =
      normalizeOperationConfigCode(rawCode) || rawCode.trim().toLowerCase();
    if (!code) {
      return {
        code: '',
        nameSnapshot: 'Configuración desconocida',
        versionSnapshot: 1,
        maxEquipmentCountSnapshot: 1,
      };
    }
    const config = await this.operationConfigurations.findByCode(
      companyId,
      code,
    );
    if (config) {
      return {
        code: config.code,
        id: config.id,
        nameSnapshot: config.name,
        versionSnapshot: config.version ?? 1,
        maxEquipmentCountSnapshot: Math.max(1, config.maxEquipmentCount ?? 1),
      };
    }
    return {
      code,
      nameSnapshot: this.fallbackOperationConfigName(code),
      versionSnapshot: 1,
      maxEquipmentCountSnapshot: 1,
    };
  }

  private fallbackOperationConfigName(code: string): string {
    const t = code.trim();
    if (!t) {
      return 'Configuración desconocida';
    }
    return t
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async resolveDieselPriceSnapshot(
    dto: CreateTripDto,
  ): Promise<string> {
    const fromDto = dto.dieselPricePerLiterAtCreation;
    if (
      fromDto != null &&
      Number.isFinite(fromDto) &&
      fromDto > 0 &&
      fromDto < 200
    ) {
      return String(roundPrice4(fromDto));
    }
    const liters = dto.dieselLiters != null ? Number(dto.dieselLiters) : NaN;
    const amount = dto.dieselAmount != null ? Number(dto.dieselAmount) : NaN;
    if (
      Number.isFinite(liters) &&
      liters > 0 &&
      Number.isFinite(amount) &&
      amount >= 0
    ) {
      return String(roundPrice4(amount / liters));
    }
    const current = await this.fuelPriceService.getCurrentDieselPrice();
    return String(roundPrice4(current));
  }

  private resolveDistanceFieldsForPersist(
    routeDistanceKm: number | undefined,
    isRoundTrip: boolean,
  ): { routeDistanceKm: string; operationalDistanceKm: string } | undefined {
    if (routeDistanceKm === undefined || routeDistanceKm === null) {
      return undefined;
    }
    const breakdown = resolveTripOperationalDistance(
      routeDistanceKm,
      isRoundTrip,
    );
    return {
      routeDistanceKm: String(breakdown.routeDistanceKm),
      operationalDistanceKm: String(breakdown.operationalDistanceKm),
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

function roundPrice4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
