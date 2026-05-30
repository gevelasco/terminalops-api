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
  return {
    id: row.id,
    companyId: row.companyId,
    postalCode: row.postalCode,
    cityMunicipality: row.cityMunicipality,
    locality: row.locality,
    prices,
    active: row.active,
    notes: row.notes ?? undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
