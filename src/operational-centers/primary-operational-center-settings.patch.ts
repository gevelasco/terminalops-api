export type PrimaryOperationalCenterSettingsPatch = {
  operationalCenterName?: string;
  operationalCenterPostalCode?: string;
  operationalCenterCityMunicipality?: string;
  operationalCenterLocality?: string;
  operationalCenterSettlementConsId?: string;
  operationalCenterLatitude?: number;
  operationalCenterLongitude?: number;
};

export function hasPrimaryOperationalCenterSettingsPatch(
  dto: PrimaryOperationalCenterSettingsPatch,
): boolean {
  return (
    dto.operationalCenterName !== undefined ||
    dto.operationalCenterPostalCode !== undefined ||
    dto.operationalCenterCityMunicipality !== undefined ||
    dto.operationalCenterLocality !== undefined ||
    dto.operationalCenterSettlementConsId !== undefined ||
    dto.operationalCenterLatitude !== undefined ||
    dto.operationalCenterLongitude !== undefined
  );
}
