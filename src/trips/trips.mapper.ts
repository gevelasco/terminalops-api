import type { IncidentAuthorLookup } from 'src/common/utils/incident-author.util';
import { formatIncidentAuthorLabel } from 'src/common/utils/incident-author.util';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { exposeTripActualSchedule } from 'src/trips/actual-schedule/resolve-exposed-actual-schedule';
import {
  buildUnitOperationalId,
  buildEquipmentOperationalId,
} from 'src/common/utils/unit-operational-id.util';

export type TripResponse = Record<string, unknown>;

function resolveOperatorDisplayName(trip: Trip): string | undefined {
  const joined = trip.operator?.name?.trim();
  return joined || undefined;
}

function resolveUnitDisplayCode(trip: Trip): string | undefined {
  if (trip.unit) {
    return buildUnitOperationalId(trip.unit);
  }
  return undefined;
}

function tripHasMarkedIncidents(incidents: TripIncident[] | undefined): boolean {
  return (incidents ?? []).some((row) => row.isIncident === true);
}

export function mapTripToResponse(
  trip: Trip,
  equipmentCatalog: Equipment[] = [],
  authorLookup?: IncidentAuthorLookup,
): TripResponse {
  const equipmentIds =
    trip.tripEquipment?.map((te) => te.equipmentId) ?? [];
  const equipmentLabels = equipmentIds.map((id) => {
    const row = equipmentCatalog.find((e) => e.id === id);
    if (!row) {
      return String(id);
    }
    return buildEquipmentOperationalId(row);
  });
  const equipmentPublicIds = equipmentIds.map((id) => {
    const row = equipmentCatalog.find((e) => e.id === id);
    return row?.id ?? id;
  });
  const exposedActual = exposeTripActualSchedule(trip);
  const mappedIncidents = (trip.incidents ?? []).map((i) =>
    mapIncident(i, authorLookup),
  );

  return {
    id: trip.id,
    companyId: trip.companyId,
    maneuverCode: trip.maneuverCode,
    clientName: trip.clientName,
    clientId: trip.client?.id ?? trip.clientId ?? '',
    unitId: trip.unit?.id ?? trip.unitId ?? '',
    operatorId: trip.operator?.id ?? trip.operatorId ?? '',
    operatorName: resolveOperatorDisplayName(trip),
    unitOperationalCode: resolveUnitDisplayCode(trip),
    status: trip.status,
    createdAt: trip.createdAt.toISOString(),
    plannedDepartureAt: trip.plannedDepartureAt.toISOString(),
    plannedArrivalAt: trip.plannedArrivalAt.toISOString(),
    plannedCompletionAt: trip.plannedCompletionAt.toISOString(),
    statusChangedAt: trip.statusChangedAt?.toISOString() ?? null,
    statusChangedBy: trip.statusChangedBy ?? null,
    completedAt: trip.completedAt?.toISOString() ?? null,
    operationType: trip.operationType,
    operationConfigurationId: trip.operationConfigurationId ?? null,
    operationConfigurationCode: trip.operationType,
    loadType: trip.loadType,
    containerType: trip.containerType,
    cargoDescription: trip.cargoDescription,
    loadDate: trip.loadDate?.toISOString() ?? null,
    loadPlace: trip.loadPlace ?? null,
    emptyDeliveryAt: trip.emptyDeliveryAt?.toISOString() ?? null,
    emptyDeliveryPlace: trip.emptyDeliveryPlace ?? null,
    approximateWeightTons: trip.approximateWeightTons,
    equipment: equipmentLabels,
    equipmentIds: equipmentPublicIds,
    departureAt: exposedActual.departureAt?.toISOString() ?? null,
    arrivedAt: exposedActual.arrivedAt?.toISOString() ?? null,
    returnAt: exposedActual.returnAt?.toISOString() ?? null,
    creditDays: trip.creditDays,
    hasIncident: tripHasMarkedIncidents(trip.incidents),
    incidents: mappedIncidents,
    routeDistanceKm: trip.routeDistanceKm ? Number(trip.routeDistanceKm) : null,
    maneuverKind: trip.maneuverKind,
    originPostalCode: trip.originPostalCode,
    originCityMunicipality: trip.originCityMunicipality,
    originLocality: trip.originLocality,
    destinationPostalCode: trip.destinationPostalCode,
    destinationCityMunicipality: trip.destinationCityMunicipality,
    destinationLocality: trip.destinationLocality,
    destinationRateId: trip.destinationRateId ?? null,
    dieselLiters: trip.dieselLiters?.toString(),
    dieselAmount: trip.dieselAmount?.toString(),
    casetasAmount: trip.casetasAmount?.toString(),
    operatorQuota: trip.operatorQuota?.toString(),
    perDiemAmount: trip.perDiemAmount?.toString(),
    clientCharge: trip.clientCharge?.toString(),
    paymentMethod: trip.paymentMethod,
    requiresInvoice: trip.requiresInvoice,
    hasClientBilling: trip.hasClientBilling,
    falseManeuver: trip.falseManeuver,
    cancellationNote: trip.cancellationNote,
    clientCollectedAt: trip.clientCollectedAt?.toISOString() ?? null,
  };
}

function mapIncident(i: TripIncident, authorLookup?: IncidentAuthorLookup) {
  return {
    id: i.id,
    description: i.description,
    createdAt: i.createdAt.toISOString(),
    postedBy: i.postedBy,
    postedByLabel: authorLookup
      ? formatIncidentAuthorLabel(i.postedBy, authorLookup)
      : i.postedBy,
    isIncident: i.isIncident === true,
  };
}
