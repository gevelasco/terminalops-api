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
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';
import { FleetStatusResolverService } from 'src/fleet/fleet-status-resolver.service';
import { Unit } from 'src/units/entities/unit.entity';
import { profileToFleetMeta } from 'src/units/mappers/unit-fleet-meta.mapper';
import { profileToFleetMeta as equipmentProfileToFleetMeta } from 'src/equipment/mappers/equipment-fleet-meta.mapper';
import {
  FleetOverviewEquipmentConvoyType,
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

function parseOperationalKm(
  raw: string | number | null | undefined,
): number | undefined {
  if (raw == null) {
    return undefined;
  }
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
      name:
        trip.operationConfigurationNameSnapshot?.trim() ||
        cfg?.name ||
        trip.operationType ||
        '',
      maxEquipmentCount:
        trip.operationConfigurationMaxEquipmentCountSnapshot ??
        cfg?.maxEquipmentCount ??
        1,
    };
  }
  return undefined;
}

function resolveOperatorDisplayName(trip: Trip): string | undefined {
  const snapshot = trip.operatorNameSnapshot?.trim();
  if (snapshot) {
    return snapshot;
  }
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
  ): Promise<FleetOverviewResponseDto> {
    const tripIdFilter =
      tripIds == null
        ? null
        : [...new Set(tripIds.filter((id) => Number.isFinite(id) && id > 0))];

    if (tripIdFilter != null && tripIdFilter.length === 0) {
      return { items: [], equipment: [] };
    }

    const allowedTripIds =
      tripIdFilter == null ? null : new Set<number>(tripIdFilter);

    const tripWhere = allowedTripIds
      ? {
          companyId,
          status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
          id: In([...allowedTripIds]),
          deletedAt: IsNull(),
        }
      : {
          companyId,
          status: In([...TRIP_FLEET_ACTIVE_STATUSES]),
          deletedAt: IsNull(),
        };

    const trips = await this.tripsRepo.find({
      where: tripWhere,
      relations: ['tripEquipment', 'tripEquipment.equipment', 'operator'],
      order: { plannedDepartureAt: 'ASC' },
    });

    if (allowedTripIds && trips.length === 0) {
      return { items: [], equipment: [] };
    }

    const unitIds = allowedTripIds
      ? [
          ...new Set(
            trips
              .map((trip) => trip.unitId)
              .filter((id): id is number => id != null),
          ),
        ]
      : null;

    if (allowedTripIds && (unitIds == null || unitIds.length === 0)) {
      return { items: [], equipment: [] };
    }

    const [units, equipment, configs, lastEndedAtByUnitId, company] =
      await Promise.all([
        unitIds
          ? this.unitsRepo.find({
              where: { companyId, id: In(unitIds) },
              relations: [
                'fleetProfile',
                'maintenanceEntries',
                'fleetDocuments',
                'equipment',
              ],
              order: { plate: 'ASC' },
            })
          : this.unitsRepo.find({
              where: { companyId },
              relations: [
                'fleetProfile',
                'maintenanceEntries',
                'fleetDocuments',
                'equipment',
              ],
              order: { plate: 'ASC' },
            }),
        unitIds
          ? this.equipmentRepo.find({
              where: { companyId, unitId: In(unitIds) },
              relations: [
                'fleetProfile',
                'maintenanceEntries',
                'fleetDocuments',
              ],
              order: { name: 'ASC' },
            })
          : this.equipmentRepo.find({
              where: { companyId },
              relations: [
                'fleetProfile',
                'maintenanceEntries',
                'fleetDocuments',
              ],
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
      const activeTrip = pickActiveTripForUnit(
        unit.id,
        tripsByUnitId,
        allowedTripIds ?? undefined,
      );
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
        unit.fleetDocuments,
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
        const routeLabel = formatCompactTripRouteLabel(
          activeTrip.origin,
          activeTrip.destination,
        );
        const exposedActual = exposeTripActualSchedule(activeTrip);
        item.trip = {
          tripId: activeTrip.id,
          maneuverCode: activeTrip.maneuverCode,
          clientName: activeTrip.clientName,
          origin: routeLabel,
          destination: formatCompactRouteEndpoint(activeTrip.destination),
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
          operationalDistanceKm: parseOperationalKm(
            activeTrip.operationalDistanceKm,
          ),
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

    const equipmentRows: FleetOverviewEquipmentRowDto[] = activeEquipment.map(
      (eq) => {
        const unit = activeUnits.find((u) => u.id === eq.unitId);
        const activeTrip =
          (eq.unitId != null
            ? pickActiveTripForUnit(
                eq.unitId,
                tripsByUnitId,
                allowedTripIds ?? undefined,
              )
            : null) ??
          tripByEquipmentId.get(eq.id) ??
          null;
        const metaRaw = equipmentProfileToFleetMeta(
          eq.fleetProfile,
          eq.maintenanceEntries,
          eq.fleetDocuments,
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
      },
    );

    const filteredItems = allowedTripIds
      ? items.filter(
          (item) => item.trip != null && allowedTripIds.has(item.trip.tripId),
        )
      : items;

    const filteredEquipmentRows = allowedTripIds
      ? equipmentRows.filter(
          (row) =>
            row.operationalStatus === 'in_transit' ||
            row.operationalStatus === 'scheduled',
        )
      : equipmentRows;

    filteredItems.sort((a, b) => {
      const d =
        this.fleetStatusResolver.overviewSortRank(b.operationalStatus) -
        this.fleetStatusResolver.overviewSortRank(a.operationalStatus);
      if (d !== 0) {
        return d;
      }
      return a.unitName.localeCompare(b.unitName, 'es');
    });

    return { items: filteredItems, equipment: filteredEquipmentRows };
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
