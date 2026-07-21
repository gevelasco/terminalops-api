import { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';
import { DestinationRatePrice } from 'src/destination-rates/entities/destination-rate-price.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

function serializeDestinationRatePrice(
  price: DestinationRatePrice,
): Record<string, unknown> {
  const cfg = price.operationConfiguration;
  return {
    id: price.id,
    operationConfigurationId:
      cfg?.id ?? price.operationConfigurationId,
    operationConfigurationCode: cfg?.code,
    operationConfigurationName: cfg?.name,
    clientCharge: price.clientCharge,
    operatorPaymentEstimate: price.operatorPaymentEstimate,
    estimatedTollAmount: price.estimatedTollAmount,
    notes: price.notes ?? undefined,
    createdAt: toIsoString(price.createdAt),
    updatedAt: toIsoString(price.updatedAt),
  };
}

export function serializeDestinationRate(
  row: DestinationRate,
): Record<string, unknown> {
  const prices = (row.prices ?? []).map((p) => serializeDestinationRatePrice(p));
  const originCenter = row.originOperationalCenter;
  return {
    id: row.id,
    companyId: row.companyId,
    originOperationalCenterId:
      originCenter?.id ?? row.originOperationalCenterId,
    originOperationalCenterName: originCenter?.name,
    originOperationalCenterCode: originCenter?.code,
    originPostalCode: row.originPostalCode,
    originCityMunicipality: row.originCityMunicipality,
    originLocality: row.originLocality,
    originLatitude:
      row.originLatitude != null ? Number(row.originLatitude) : undefined,
    originLongitude:
      row.originLongitude != null ? Number(row.originLongitude) : undefined,
    postalCode: row.postalCode,
    cityMunicipality: row.cityMunicipality,
    locality: row.locality,
    destinationLatitude:
      row.destinationLatitude != null ? Number(row.destinationLatitude) : undefined,
    destinationLongitude:
      row.destinationLongitude != null ? Number(row.destinationLongitude) : undefined,
    routeDistanceKm:
      row.routeDistanceKm != null ? Number(row.routeDistanceKm) : undefined,
    // Siempre ida×2; columnas operational_distance_km / is_round_trip dropeadas.
    operationalDistanceKm:
      row.routeDistanceKm != null && Number(row.routeDistanceKm) > 0
        ? Number(row.routeDistanceKm) * 2
        : undefined,
    isRoundTrip: true,
    distanceCalculatedAt: row.distanceCalculatedAt
      ? toIsoString(row.distanceCalculatedAt)
      : undefined,
    estimatedArrivalTimeValue:
      row.estimatedArrivalTimeValue != null
        ? Number(row.estimatedArrivalTimeValue)
        : undefined,
    estimatedReturnTimeValue:
      row.estimatedReturnTimeValue != null
        ? Number(row.estimatedReturnTimeValue)
        : undefined,
    estimatedTimeUnit: row.estimatedTimeUnit ?? undefined,
    maneuverCount:
      typeof row.maneuverCount === 'number' ? row.maneuverCount : undefined,
    prices,
    active: row.active,
    notes: row.notes ?? undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
