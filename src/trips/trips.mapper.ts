import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';

export type TripResponse = Record<string, unknown>;

export function mapTripToResponse(
  trip: Trip,
  equipmentCatalog: Equipment[] = [],
  companyPublicId?: number,
): TripResponse {
  const equipmentIds =
    trip.tripEquipment?.map((te) => te.equipmentId) ?? [];
  const equipmentLabels = equipmentIds.map((id) => {
    const row = equipmentCatalog.find((e) => e.id === id);
    return row?.name ?? row?.plate ?? String(row?.publicId ?? id);
  });
  const equipmentPublicIds = equipmentIds.map((id) => {
    const row = equipmentCatalog.find((e) => e.id === id);
    return row?.publicId ?? 0;
  });

  return {
    id: trip.publicId,
    ...(companyPublicId != null ? { companyId: companyPublicId } : {}),
    maneuverCode: trip.maneuverCode,
    origin: trip.origin,
    destination: trip.destination,
    clientName: trip.clientName,
    clientId: trip.client?.publicId ?? '',
    unitId: trip.unit?.publicId ?? '',
    operatorId: trip.operator?.publicId ?? '',
    status: trip.status,
    programmedAt: trip.programmedAt.toISOString(),
    scheduledAt: trip.scheduledAt.toISOString(),
    operationType: trip.operationType,
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
    incidents: (trip.incidents ?? []).map(mapIncident),
    routeDistanceKm: trip.routeDistanceKm ? Number(trip.routeDistanceKm) : null,
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
    casetasAmount: trip.casetasAmount?.toString(),
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

function mapIncident(i: TripIncident) {
  return {
    id: i.publicId,
    description: i.description,
    occurredAt: i.occurredAt.toISOString(),
    postedBy: i.postedBy,
    severity: i.severity,
  };
}
