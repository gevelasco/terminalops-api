import type { OperationalCenter } from './entities/operational-center.entity';

function coordToApi(value?: string | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export type OperationalCenterGeoForApi = {
  operationalCenterName: string;
  operationalCenterPostalCode?: string;
  operationalCenterCityMunicipality?: string;
  operationalCenterLocality?: string;
  operationalCenterSettlementConsId?: string;
  operationalCenterLatitude?: number;
  operationalCenterLongitude?: number;
};

/** Geo operativo expuesto en API — SSOT exclusivo: operational_centers. */
export function operationalCenterGeoForApi(
  primaryCenter?: Pick<
    OperationalCenter,
    | 'name'
    | 'postalCode'
    | 'cityMunicipality'
    | 'locality'
    | 'settlementConsId'
    | 'latitude'
    | 'longitude'
  > | null,
): OperationalCenterGeoForApi {
  return {
    operationalCenterName: primaryCenter?.name?.trim() || 'Centro Principal',
    operationalCenterPostalCode: primaryCenter?.postalCode ?? undefined,
    operationalCenterCityMunicipality: primaryCenter?.cityMunicipality ?? undefined,
    operationalCenterLocality: primaryCenter?.locality ?? undefined,
    operationalCenterSettlementConsId: primaryCenter?.settlementConsId ?? undefined,
    operationalCenterLatitude: coordToApi(primaryCenter?.latitude),
    operationalCenterLongitude: coordToApi(primaryCenter?.longitude),
  };
}
