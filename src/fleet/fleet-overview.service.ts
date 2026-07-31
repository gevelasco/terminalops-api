import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  formatCompactRouteEndpoint,
  formatCompactTripRouteLabel,
} from 'src/common/utils/trip-route-label.util';
import { buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';
import { toIsoString } from 'src/common/utils/iso-date.util';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Company } from 'src/companies/entities/company.entity';
import { CompanyOperationConfiguration } from 'src/operation-configurations/entities/company-operation-configuration.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { exposeTripActualSchedule } from 'src/trips/actual-schedule/resolve-exposed-actual-schedule';
import {
  buildTripDestinationLabel,
  buildTripOriginLabel,
} from 'src/trips/trip-route-label.util';
import { operationalKmFromStoredTrip } from 'src/trips/trip-operational-distance.util';
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';
import { FleetStatusResolverService } from 'src/fleet/fleet-status-resolver.service';
import { Unit } from 'src/units/entities/unit.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';
import { profileToFleetMeta } from 'src/units/mappers/unit-fleet-meta.mapper';
import { profileToFleetMeta as equipmentProfileToFleetMeta } from 'src/equipment/mappers/equipment-fleet-meta.mapper';
import {  FleetOverviewEquipmentConvoyType,
  FleetOverviewEquipmentRowDto,
  FleetOverviewItemDto,
  FleetOverviewResponseDto,
  FleetOverviewTripStatus,
} from './dto/fleet-overview.dto';
import {
  buildMaintenanceSummary,
  type FleetMetaLike,
} from './fleet-overview-maintenance.util';
import { companyMaintenancePolicyContext } from 'src/units/company-maintenance-policy.util';
import { daysWithoutManeuverSince } from './fleet-overview-idle.util';
import {
  loadLatestMaintenanceByOwnerIds,
  loadLatestVerificationByOwnerIds,
} from './fleet-latest-entries.loader';

export type FleetOverviewListOptions = {
  /** Reports: omite filas de equipo (solo usa items de unidad). */
  includeEquipmentRows?: boolean;
};

function metaString(
  meta: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const v = meta?.[key];
  return typeof v === 'string' ? v : undefined;
}

function toFleetMetaLike(
  meta: Record<string, unknown> | undefined,
): FleetMetaLike | undefined {
  if (!meta) {
    return undefined;
  }
  return meta;
}

function convoyTypeFromCount(count: number): FleetOverviewEquipmentConvoyType {
  if (count <= 0) {
    return 'none';
  }
  if (count === 1) {
    return 'single';
  }
  if (count >= 2) {
    return 'full';
  }
  return 'trailer';
}

function sortHitchedEquipment(list: Equipment[]): Equipment[] {
  return [...list].sort((a, b) => {
    const pos = (p?: string | null) => (p === 'rear' ? 1 : 0);
    const d = pos(a.hitchPosition) - pos(b.hitchPosition);
    if (d !== 0) {
      return d;
    }
    return a.id - b.id;
  });
}

function buildEquipmentOperationalCode(eq: Equipment): string {
  const abbr = (eq.trailerBrandAbbr ?? '').trim().toUpperCase();
  const year = (eq.trailerYear ?? '').trim();
  const plate = (eq.plate ?? '').trim().replace(/\s+/g, '-');
  if (abbr && year && plate) {
    return `${abbr}-${year}-${plate}`;
  }
  return String(eq.id);
}

function tripStatus(raw: string): FleetOverviewTripStatus {
  if (raw === 'in_transit' || raw === 'scheduled' || raw === 'completed') {
    return raw;
  }
  return 'scheduled';
}

function resolveConfiguration(
  trip: Trip | null,
  configsById: Map<number, CompanyOperationConfiguration>,
): FleetOverviewItemDto['configuration'] {
  if (trip?.operationConfigurationId) {
    const cfg = configsById.get(trip.operationConfigurationId);
    return {
      id: trip.operationConfigurationId,
      code: trip.operationType?.trim() || cfg?.code || '',
      name: cfg?.name || trip.operationType || '',
      maxEquipmentCount: cfg?.maxEquipmentCount ?? 1,
    };
  }
  return undefined;
}

function resolveOperatorDisplayName(trip: Trip): string | undefined {
  const joined = trip.operator?.name?.trim();
  return joined || undefined;
}

function pickActiveTripForUnit(
  unitId: number,
  tripsByUnitId: Map<number, Trip[]>,
  allowedTripIds?: ReadonlySet<number>,
): Trip | null {
  let mine = tripsByUnitId.get(unitId) ?? [];
  if (allowedTripIds) {
    mine = mine.filter((trip) => allowedTripIds.has(trip.id));
  }
  const inTransit = mine.find((t) => t.status === 'in_transit');
  if (inTransit) {
    return inTransit;
  }
  const scheduled = mine
    .filter((t) => t.status === 'scheduled')
    .slice()
    .sort(
      (a, b) => a.plannedDepartureAt.getTime() - b.plannedDepartureAt.getTime(),
    );
  return scheduled[0] ?? null;
}

@Injectable()
export class FleetOverviewService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(CompanyOperationConfiguration)
    private readonly configsRepo: Repository<CompanyOperationConfiguration>,
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
    private readonly fleetStatusResolver: FleetStatusResolverService,
  ) {}

  async listOverview(
    companyId: number,
    tripIds?: readonly number[],
    options?: FleetOverviewListOptions,
  ): Promise<FleetOverviewResponseDto> {
    const includeEquipmentRows = options?.includeEquipmentRows !== false;
    const tripIdFilter =
      tripIds == null
        ? null
        : [...new Set(tripIds.filter((id) => Number.isFinite(id) && id > 0))];

    if (tripIdFilter != null && tripIdFilter.length === 0) {
      return { items: [], equipment: [] };
    }

    const allowedTripIds =
      tripIdFilter == null ? null : new Set<number>(tripIdFilter);

    // Path del mapa/estado: solo cards de maniobra → sin mantenimiento ni idle.
    if (allowedTripIds) {
      return this.listOverviewForTripIds(companyId, allowedTripIds);
    }

    const tripWhere = {
      companyId,
      status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
      deletedAt: IsNull(),
    };

    const trips = await this.tripsRepo.find({
      where: tripWhere,
      relations: ['tripEquipment', 'operator'],
      order: { plannedDepartureAt: 'ASC' },
    });

    const unitIds = null;

    const [unitsRaw, equipmentRaw, configs, lastEndedAtByUnitId, company] =
      await Promise.all([
        this.unitsRepo.find({
          where: { companyId },
          relations: ['fleetProfile'],
          order: { plate: 'ASC' },
        }),
        this.equipmentRepo.find({
          where: { companyId },
          relations: ['fleetProfile'],
          order: { name: 'ASC' },
        }),
        this.configsRepo.find({
          where: { companyId, active: true },
          order: { name: 'ASC' },
        }),
        this.queryLastEndedAtByUnit(companyId, unitIds),
        this.companiesRepo.findOne({
          where: { id: companyId },
          select: [
            'id',
            'maintenanceKmControlEnabled',
            'maintenanceKmIntervalDefault',
            'maintenanceDateControlEnabled',
            'maintenanceDatePeriodDefault',
          ],
        }),
      ]);

    const loadedUnitIds = unitsRaw.map((u) => u.id);
    const loadedEquipmentIds = equipmentRaw.map((e) => e.id);
    const schema = this.unitsRepo.metadata.schema ?? 'terminalops';
    const [unitMaint, unitVerif, eqMaint, eqVerif] = await Promise.all([
      loadLatestMaintenanceByOwnerIds(
        this.unitsRepo.manager,
        schema,
        'unit_id',
        loadedUnitIds,
      ),
      loadLatestVerificationByOwnerIds(
        this.unitsRepo.manager,
        schema,
        'unit_id',
        loadedUnitIds,
      ),
      includeEquipmentRows
        ? loadLatestMaintenanceByOwnerIds(
            this.unitsRepo.manager,
            schema,
            'equipment_id',
            loadedEquipmentIds,
          )
        : Promise.resolve(new Map<number, FleetMaintenanceEntry[]>()),
      includeEquipmentRows
        ? loadLatestVerificationByOwnerIds(
            this.unitsRepo.manager,
            schema,
            'equipment_id',
            loadedEquipmentIds,
          )
        : Promise.resolve(new Map<number, FleetVerificationEntry[]>()),
    ]);

    const units = unitsRaw.map((unit) => {
      unit.maintenanceEntries = unitMaint.get(unit.id) ?? [];
      unit.verificationEntries = unitVerif.get(unit.id) ?? [];
      return unit;
    });
    const equipment = equipmentRaw.map((eq) => {
      eq.maintenanceEntries = eqMaint.get(eq.id) ?? [];
      eq.verificationEntries = eqVerif.get(eq.id) ?? [];
      return eq;
    });

    const maintenancePolicy = companyMaintenancePolicyContext(company);

    const activeUnits = units.filter((u) => u.isActive !== false);
    const activeEquipment = equipment.filter((e) => e.isActive !== false);

    const configsById = new Map(configs.map((c) => [c.id, c]));
    const equipmentByUnitId = new Map<number, Equipment[]>();
    for (const eq of activeEquipment) {
      if (eq.unitId == null) {
        continue;
      }
      const list = equipmentByUnitId.get(eq.unitId) ?? [];
      list.push(eq);
      equipmentByUnitId.set(eq.unitId, list);
    }

    const tripsByUnitId = new Map<number, Trip[]>();
    const tripByEquipmentId = new Map<number, Trip>();
    for (const trip of trips) {
      if (trip.unitId != null) {
        const list = tripsByUnitId.get(trip.unitId) ?? [];
        list.push(trip);
        tripsByUnitId.set(trip.unitId, list);
      }
      for (const te of trip.tripEquipment ?? []) {
        tripByEquipmentId.set(te.equipmentId, trip);
      }
    }

    const items: FleetOverviewItemDto[] = activeUnits.map((unit) => {
      const hitched = sortHitchedEquipment(
        equipmentByUnitId.get(unit.id) ?? unit.equipment ?? [],
      );
      const activeTrip = pickActiveTripForUnit(unit.id, tripsByUnitId);
      const operationalStatus =
        this.fleetStatusResolver.resolveOverviewOperationalStatus({
          persistedStatus: unit.status,
          activeTripStatus:
            activeTrip?.status === 'in_transit' ||
            activeTrip?.status === 'scheduled'
              ? activeTrip.status
              : undefined,
          isActive: unit.isActive !== false,
        });
      const unitMetaRaw = profileToFleetMeta(
        unit.fleetProfile,
        unit.maintenanceEntries,
        undefined,
        undefined,
        unit.verificationEntries,
        { includeHistory: false },
      );
      const unitMeta = toFleetMetaLike(unitMetaRaw);
      const convoyType = convoyTypeFromCount(hitched.length);
      const primaryEq = hitched[0] ?? null;

      const item: FleetOverviewItemDto = {
        unitId: unit.id,
        unitName: buildUnitOperationalId(unit),
        unitAlias: unit.name?.trim() || undefined,
        unitPlate: unit.plate?.trim() || '',
        unitTransportType: unit.transportType?.trim() || undefined,
        equipment: {
          equipmentId: primaryEq?.id ?? null,
          type: convoyType,
          status: this.fleetStatusResolver.persistedAssetStatus(
            primaryEq?.status ?? unit.status,
          ),
        },
        hitchedEquipment: hitched.map((eq) => ({
          equipmentId: eq.id,
          operationalCode: buildEquipmentOperationalCode(eq),
          alias: eq.name?.trim() || undefined,
          equipmentType: (eq.type ?? '').trim() || '—',
          hitchPosition:
            eq.hitchPosition === 'lead' || eq.hitchPosition === 'rear'
              ? eq.hitchPosition
              : undefined,
          status: this.fleetStatusResolver.persistedAssetStatus(eq.status),
        })),
        operationalStatus,
        configuration: resolveConfiguration(activeTrip, configsById),
      };

      if (activeTrip) {
        // Preferir ciudad/municipio (compacto en card); si falta, label postal completo.
        const originLabel =
          activeTrip.originCityMunicipality?.trim() ||
          buildTripOriginLabel(activeTrip);
        const destinationLabel =
          activeTrip.destinationCityMunicipality?.trim() ||
          buildTripDestinationLabel(activeTrip);
        const routeLabel = formatCompactTripRouteLabel(
          originLabel,
          destinationLabel,
        );
        const exposedActual = exposeTripActualSchedule(activeTrip);
        item.trip = {
          tripId: activeTrip.id,
          maneuverCode: activeTrip.maneuverCode,
          clientName: activeTrip.clientName,
          origin: routeLabel,
          destination: formatCompactRouteEndpoint(destinationLabel),
          status: tripStatus(activeTrip.status),
          plannedDepartureAt:
            toIsoString(activeTrip.plannedDepartureAt) ?? undefined,
          plannedArrivalAt:
            toIsoString(activeTrip.plannedArrivalAt) ?? undefined,
          plannedCompletionAt:
            toIsoString(activeTrip.plannedCompletionAt) ?? undefined,
          departureAt: toIsoString(exposedActual.departureAt) ?? undefined,
          arrivedAt: toIsoString(exposedActual.arrivedAt) ?? undefined,
          returnAt: toIsoString(exposedActual.returnAt) ?? undefined,
          operationalDistanceKm:
            operationalKmFromStoredTrip(
              activeTrip.routeDistanceKm
                ? Number(activeTrip.routeDistanceKm)
                : null,
            ) ?? undefined,
          operatorName: resolveOperatorDisplayName(activeTrip),
        };
      } else {
        const maint = buildMaintenanceSummary(unitMeta, maintenancePolicy);
        item.maintenance = {
          lastMaintenanceDate: maint.lastMaintenanceDate,
          nextMaintenanceDate: maint.nextMaintenanceDate,
          kmSinceLastMaintenance: maint.kmSinceLastMaintenance,
          tireStatus: maint.tireStatus,
          insuranceStatus: maint.insuranceStatus,
          inspectionStatus: maint.inspectionStatus,
          maintenanceRenewal: maint.maintenanceRenewal,
          insuranceRenewal: maint.insuranceRenewal,
          inspectionRenewal: maint.inspectionRenewal,
        };
        if (!item.configuration && hitched.length > 0) {
          const code = (hitched[0]?.type ?? '').trim();
          const match = configs.find(
            (c) => c.code.trim().toLowerCase() === code.toLowerCase(),
          );
          if (match) {
            item.configuration = {
              id: match.id,
              code: match.code,
              name: match.name,
              maxEquipmentCount: match.maxEquipmentCount,
            };
          }
        }
        if (operationalStatus === 'available') {
          const lastEndedAt = lastEndedAtByUnitId.get(unit.id);
          item.daysWithoutManeuver = lastEndedAt
            ? daysWithoutManeuverSince(lastEndedAt)
            : 0;
        }
      }

      return item;
    });

    const equipmentRows: FleetOverviewEquipmentRowDto[] = includeEquipmentRows
      ? activeEquipment.map((eq) => {
          const unit = activeUnits.find((u) => u.id === eq.unitId);
          const activeTrip =
            (eq.unitId != null
              ? pickActiveTripForUnit(eq.unitId, tripsByUnitId)
              : null) ??
            tripByEquipmentId.get(eq.id) ??
            null;
          const metaRaw = equipmentProfileToFleetMeta(
            eq.fleetProfile,
            eq.maintenanceEntries,
            undefined,
            undefined,
            eq.verificationEntries,
            { includeHistory: false },
          );
          const meta = toFleetMetaLike(metaRaw);
          const brand =
            metaString(metaRaw, 'trailerBrandName')?.trim() ||
            eq.trailerBrandAbbr?.trim() ||
            '—';
          const modelParts = [
            eq.trailerYear?.trim(),
            metaString(metaRaw, 'trailerVersion')?.trim(),
          ].filter(Boolean);
          const maint =
            activeTrip == null
              ? buildMaintenanceSummary(meta, maintenancePolicy)
              : undefined;

          return {
            equipmentId: eq.id,
            unitId: eq.unitId ?? null,
            unitName: unit ? buildUnitOperationalId(unit) : null,
            operationalCode: buildEquipmentOperationalCode(eq),
            alias: eq.name?.trim() || undefined,
            brand,
            model: modelParts.length ? modelParts.join(' · ') : '—',
            plate: eq.plate?.trim() || '—',
            equipmentType: (eq.type ?? '').trim() || '—',
            operationalStatus:
              this.fleetStatusResolver.resolveOverviewOperationalStatus({
                persistedStatus: eq.status,
                activeTripStatus:
                  activeTrip?.status === 'in_transit' ||
                  activeTrip?.status === 'scheduled'
                    ? activeTrip.status
                    : undefined,
                isActive: eq.isActive !== false,
              }),
            maintenance: maint
              ? {
                  lastMaintenanceDate: maint.lastMaintenanceDate,
                  nextMaintenanceDate: maint.nextMaintenanceDate,
                  kmSinceLastMaintenance: maint.kmSinceLastMaintenance,
                  tireStatus: maint.tireStatus,
                  insuranceStatus: maint.insuranceStatus,
                  inspectionStatus: maint.inspectionStatus,
                  maintenanceRenewal: maint.maintenanceRenewal,
                  insuranceRenewal: maint.insuranceRenewal,
                  inspectionRenewal: maint.inspectionRenewal,
                }
              : undefined,
          };
        })
      : [];

    items.sort((a, b) => {
      const d =
        this.fleetStatusResolver.overviewSortRank(b.operationalStatus) -
        this.fleetStatusResolver.overviewSortRank(a.operationalStatus);
      if (d !== 0) {
        return d;
      }
      return a.unitName.localeCompare(b.unitName, 'es');
    });

    return { items, equipment: equipmentRows };
  }

  /**
   * Variante ligera para el mapa (tripIds): solo unidades/equipo de esas
   * maniobras, sin perfiles de mantenimiento ni «días sin maniobra».
   */
  private async listOverviewForTripIds(
    companyId: number,
    allowedTripIds: ReadonlySet<number>,
  ): Promise<FleetOverviewResponseDto> {
    const trips = await this.tripsRepo.find({
      where: {
        companyId,
        status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
        id: In([...allowedTripIds]),
        deletedAt: IsNull(),
      },
      relations: ['tripEquipment', 'operator'],
      order: { plannedDepartureAt: 'ASC' },
    });

    if (trips.length === 0) {
      return { items: [], equipment: [] };
    }

    const unitIds = [
      ...new Set(
        trips
          .map((trip) => trip.unitId)
          .filter((id): id is number => id != null),
      ),
    ];
    if (unitIds.length === 0) {
      return { items: [], equipment: [] };
    }

    const equipmentIdsFromTrips = [
      ...new Set(
        trips.flatMap((trip) =>
          (trip.tripEquipment ?? []).map((te) => te.equipmentId),
        ),
      ),
    ];

    const [unitsRaw, equipmentRaw, configs] = await Promise.all([
      this.unitsRepo.find({
        where: { companyId, id: In(unitIds) },
        order: { plate: 'ASC' },
      }),
      this.equipmentRepo.find({
        where:
          equipmentIdsFromTrips.length > 0
            ? [
                { companyId, unitId: In(unitIds) },
                { companyId, id: In(equipmentIdsFromTrips) },
              ]
            : { companyId, unitId: In(unitIds) },
        order: { name: 'ASC' },
      }),
      this.configsRepo.find({
        where: { companyId, active: true },
        order: { name: 'ASC' },
      }),
    ]);

    const activeUnits = unitsRaw.filter((u) => u.isActive !== false);
    const activeEquipment = equipmentRaw.filter((e) => e.isActive !== false);
    const configsById = new Map(configs.map((c) => [c.id, c]));

    const equipmentByUnitId = new Map<number, Equipment[]>();
    for (const eq of activeEquipment) {
      if (eq.unitId == null) {
        continue;
      }
      const list = equipmentByUnitId.get(eq.unitId) ?? [];
      list.push(eq);
      equipmentByUnitId.set(eq.unitId, list);
    }

    const tripsByUnitId = new Map<number, Trip[]>();
    const tripByEquipmentId = new Map<number, Trip>();
    for (const trip of trips) {
      if (trip.unitId != null) {
        const list = tripsByUnitId.get(trip.unitId) ?? [];
        list.push(trip);
        tripsByUnitId.set(trip.unitId, list);
      }
      for (const te of trip.tripEquipment ?? []) {
        tripByEquipmentId.set(te.equipmentId, trip);
      }
    }

    const items: FleetOverviewItemDto[] = [];
    for (const unit of activeUnits) {
      const hitched = sortHitchedEquipment(
        equipmentByUnitId.get(unit.id) ?? [],
      );
      const activeTrip = pickActiveTripForUnit(
        unit.id,
        tripsByUnitId,
        allowedTripIds,
      );
      if (!activeTrip || !allowedTripIds.has(activeTrip.id)) {
        continue;
      }

      const operationalStatus =
        this.fleetStatusResolver.resolveOverviewOperationalStatus({
          persistedStatus: unit.status,
          activeTripStatus:
            activeTrip.status === 'in_transit' ||
            activeTrip.status === 'scheduled'
              ? activeTrip.status
              : undefined,
          isActive: unit.isActive !== false,
        });
      const convoyType = convoyTypeFromCount(hitched.length);
      const primaryEq = hitched[0] ?? null;
      const originLabel =
        activeTrip.originCityMunicipality?.trim() ||
        buildTripOriginLabel(activeTrip);
      const destinationLabel =
        activeTrip.destinationCityMunicipality?.trim() ||
        buildTripDestinationLabel(activeTrip);
      const routeLabel = formatCompactTripRouteLabel(
        originLabel,
        destinationLabel,
      );
      const exposedActual = exposeTripActualSchedule(activeTrip);

      items.push({
        unitId: unit.id,
        unitName: buildUnitOperationalId(unit),
        unitAlias: unit.name?.trim() || undefined,
        unitPlate: unit.plate?.trim() || '',
        unitTransportType: unit.transportType?.trim() || undefined,
        equipment: {
          equipmentId: primaryEq?.id ?? null,
          type: convoyType,
          status: this.fleetStatusResolver.persistedAssetStatus(
            primaryEq?.status ?? unit.status,
          ),
        },
        hitchedEquipment: hitched.map((eq) => ({
          equipmentId: eq.id,
          operationalCode: buildEquipmentOperationalCode(eq),
          alias: eq.name?.trim() || undefined,
          equipmentType: (eq.type ?? '').trim() || '—',
          hitchPosition:
            eq.hitchPosition === 'lead' || eq.hitchPosition === 'rear'
              ? eq.hitchPosition
              : undefined,
          status: this.fleetStatusResolver.persistedAssetStatus(eq.status),
        })),
        operationalStatus,
        configuration: resolveConfiguration(activeTrip, configsById),
        trip: {
          tripId: activeTrip.id,
          maneuverCode: activeTrip.maneuverCode,
          clientName: activeTrip.clientName,
          origin: routeLabel,
          destination: formatCompactRouteEndpoint(destinationLabel),
          status: tripStatus(activeTrip.status),
          plannedDepartureAt:
            toIsoString(activeTrip.plannedDepartureAt) ?? undefined,
          plannedArrivalAt:
            toIsoString(activeTrip.plannedArrivalAt) ?? undefined,
          plannedCompletionAt:
            toIsoString(activeTrip.plannedCompletionAt) ?? undefined,
          departureAt: toIsoString(exposedActual.departureAt) ?? undefined,
          arrivedAt: toIsoString(exposedActual.arrivedAt) ?? undefined,
          returnAt: toIsoString(exposedActual.returnAt) ?? undefined,
          operationalDistanceKm:
            operationalKmFromStoredTrip(
              activeTrip.routeDistanceKm
                ? Number(activeTrip.routeDistanceKm)
                : null,
            ) ?? undefined,
          operatorName: resolveOperatorDisplayName(activeTrip),
        },
      });
    }

    const equipmentRows: FleetOverviewEquipmentRowDto[] = [];
    for (const eq of activeEquipment) {
      const unit = activeUnits.find((u) => u.id === eq.unitId);
      const activeTrip =
        (eq.unitId != null
          ? pickActiveTripForUnit(eq.unitId, tripsByUnitId, allowedTripIds)
          : null) ??
        tripByEquipmentId.get(eq.id) ??
        null;
      const operationalStatus =
        this.fleetStatusResolver.resolveOverviewOperationalStatus({
          persistedStatus: eq.status,
          activeTripStatus:
            activeTrip?.status === 'in_transit' ||
            activeTrip?.status === 'scheduled'
              ? activeTrip.status
              : undefined,
          isActive: eq.isActive !== false,
        });
      if (
        operationalStatus !== 'in_transit' &&
        operationalStatus !== 'scheduled'
      ) {
        continue;
      }
      equipmentRows.push({
        equipmentId: eq.id,
        unitId: eq.unitId ?? null,
        unitName: unit ? buildUnitOperationalId(unit) : null,
        operationalCode: buildEquipmentOperationalCode(eq),
        alias: eq.name?.trim() || undefined,
        brand: eq.trailerBrandAbbr?.trim() || '—',
        model: eq.trailerYear?.trim() || '—',
        plate: eq.plate?.trim() || '—',
        equipmentType: (eq.type ?? '').trim() || '—',
        operationalStatus,
      });
    }

    items.sort((a, b) => {
      const d =
        this.fleetStatusResolver.overviewSortRank(b.operationalStatus) -
        this.fleetStatusResolver.overviewSortRank(a.operationalStatus);
      if (d !== 0) {
        return d;
      }
      return a.unitName.localeCompare(b.unitName, 'es');
    });

    return { items, equipment: equipmentRows };
  }

  /**
   * Última fecha de fin de maniobra por unidad (para «días sin maniobra»),
   * agregada en SQL: antes se cargaba el historial completo de terminadas
   * solo para calcular este máximo en JS.
   */
  private async queryLastEndedAtByUnit(
    companyId: number,
    unitIds: readonly number[] | null,
  ): Promise<Map<number, Date>> {
    const schema = this.tripsRepo.metadata.schema;
    const params: unknown[] = [companyId];
    let unitFilter = '';
    if (unitIds != null) {
      if (unitIds.length === 0) {
        return new Map();
      }
      params.push(unitIds);
      unitFilter = 'AND trip.unit_id = ANY($2::int[])';
    }
    const rows: Array<{
      unit_id: number;
      last_ended_at: Date | string | null;
    }> = await this.tripsRepo.query(
      `
      SELECT
        trip.unit_id AS unit_id,
        MAX(COALESCE(
          trip.completed_at,
          trip.return_at,
          trip.planned_completion_at,
          trip.status_changed_at,
          trip.updated_at
        )) AS last_ended_at
      FROM ${schema}.trips trip
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND trip.status IN ('completed', 'cancelled')
        AND trip.unit_id IS NOT NULL
        ${unitFilter}
      GROUP BY trip.unit_id
      `,
      params,
    );

    const map = new Map<number, Date>();
    for (const row of rows) {
      if (row.last_ended_at == null) {
        continue;
      }
      const d =
        row.last_ended_at instanceof Date
          ? row.last_ended_at
          : new Date(row.last_ended_at);
      if (!Number.isNaN(d.getTime())) {
        map.set(Number(row.unit_id), d);
      }
    }
    return map;
  }
}
