import type { IncidentAuthorLookup } from 'src/common/utils/incident-author.util';
import { formatIncidentAuthorLabel } from 'src/common/utils/incident-author.util';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { tripDieselPricePerLiterAtCreation } from 'src/trips/trip-diesel-price.util';
import { operationalKmFromStoredTrip } from 'src/trips/trip-operational-distance.util';
import { buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';

export type TripResponse = Record<string, unknown>;

function resolveOperatorDisplayName(trip: Trip): string | undefined {
  const snapshot = trip.operatorNameSnapshot?.trim();
  if (snapshot) {
    return snapshot;
  }
  const joined = trip.operator?.name?.trim();
  return joined || undefined;
}

function resolveUnitDisplayCode(trip: Trip): string | undefined {
  const snapshot = trip.unitOperationalCodeSnapshot?.trim();
  if (snapshot) {
    return snapshot;
  }
  if (trip.unit) {
    return buildUnitOperationalId(trip.unit);
  }
  return undefined;
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
    return row?.name ?? row?.plate ?? String(id);
  });
  const equipmentPublicIds = equipmentIds.map((id) => {
    const row = equipmentCatalog.find((e) => e.id === id);
    return row?.id ?? id;
  });

  return {
    id: trip.id,
    companyId: trip.companyId,
    maneuverCode: trip.maneuverCode,
    origin: trip.origin,
    destination: trip.destination,
    clientName: trip.clientName,
    clientId: trip.client?.id ?? trip.clientId ?? '',
    unitId: trip.unit?.id ?? trip.unitId ?? '',
    operatorId: trip.operator?.id ?? trip.operatorId ?? '',
    operatorNameSnapshot: trip.operatorNameSnapshot ?? undefined,
    unitOperationalCodeSnapshot: trip.unitOperationalCodeSnapshot ?? undefined,
    operatorName: resolveOperatorDisplayName(trip),
    unitOperationalCode: resolveUnitDisplayCode(trip),
    status: trip.status,
    programmedAt: trip.programmedAt.toISOString(),
    scheduledAt: trip.scheduledAt.toISOString(),
    operationType: trip.operationType,
    operationConfigurationId: trip.operationConfigurationId ?? null,
    operationConfigurationCode: trip.operationType,
    operationConfigurationNameSnapshot: trip.operationConfigurationNameSnapshot,
    operationConfigurationVersionSnapshot: trip.operationConfigurationVersionSnapshot,
    operationConfigurationMaxEquipmentCountSnapshot:
      trip.operationConfigurationMaxEquipmentCountSnapshot,
    loadType: trip.loadType,
    containerType: trip.containerType,
    cargoDescription: trip.cargoDescription,
    approximateWeightTons: trip.approximateWeightTons,
    equipment: equipmentLabels,
    equipmentIds: equipmentPublicIds,
    departureAt: trip.departureAt?.toISOString() ?? null,
    arrivedAt: trip.arrivedAt?.toISOString() ?? null,
    returnAt: trip.returnAt?.toISOString() ?? null,
    creditDays: trip.creditDays,
    hasIncident: trip.hasIncident,
    incidents: (trip.incidents ?? []).map((i) => mapIncident(i, authorLookup)),
    routeDistanceKm: trip.routeDistanceKm ? Number(trip.routeDistanceKm) : null,
    operationalDistanceKm: operationalKmFromStoredTrip(
      trip.routeDistanceKm ? Number(trip.routeDistanceKm) : null,
      trip.operationalDistanceKm ? Number(trip.operationalDistanceKm) : null,
      trip.isRoundTrip,
    ),
    isRoundTrip: trip.isRoundTrip !== false,
    maneuverKind: trip.maneuverKind,
    originPostalCode: trip.originPostalCode,
    originCityMunicipality: trip.originCityMunicipality,
    originLocality: trip.originLocality,
    destinationPostalCode: trip.destinationPostalCode,
    destinationCityMunicipality: trip.destinationCityMunicipality,
    destinationLocality: trip.destinationLocality,
    operatorLicenseNumber: trip.operatorLicenseNumber,
    operatorLicenseExpiresLabel: trip.operatorLicenseExpiresLabel,
    dieselLiters: trip.dieselLiters?.toString(),
    dieselAmount: trip.dieselAmount?.toString(),
    dieselPricePerLiterAtCreation: tripDieselPricePerLiterAtCreation(trip),
    casetasAmount: trip.casetasAmount?.toString(),
    tollRouteId: trip.tollRouteId ?? null,
    tollCalculationMode: trip.tollCalculationMode ?? null,
    routeTollAmount: trip.routeTollAmount ? Number(trip.routeTollAmount) : null,
    operatorQuota: trip.operatorQuota?.toString(),
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
    occurredAt: i.occurredAt.toISOString(),
    postedBy: i.postedBy,
    postedByLabel: authorLookup
      ? formatIncidentAuthorLabel(i.postedBy, authorLookup)
      : i.postedBy,
    severity: i.severity,
  };
}
