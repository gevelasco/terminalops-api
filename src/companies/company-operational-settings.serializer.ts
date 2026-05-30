import { Company } from 'src/companies/entities/company.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

function dbNumToApi(value?: string | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function dbCoordToApi(value?: string | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function serializeCompanyOperationalSettings(company: Company) {
  return {
    id: company.id,
    name: company.name,
    operationalAnalysisEnabled: company.operationalAnalysisEnabled,
    operationalAnalysisChangedAt: toIsoString(company.operationalAnalysisChangedAt),
    maintenanceKmControlEnabled: company.maintenanceKmControlEnabled,
    maintenanceKmIntervalDefault: dbNumToApi(company.maintenanceKmIntervalDefault),
    maintenanceKmControlChangedAt: toIsoString(company.maintenanceKmControlChangedAt),
    maintenanceDateControlEnabled: company.maintenanceDateControlEnabled,
    maintenanceDatePeriodDefault: company.maintenanceDatePeriodDefault ?? undefined,
    maintenanceDateControlChangedAt: toIsoString(company.maintenanceDateControlChangedAt),
    dieselControlEnabled: company.dieselControlEnabled,
    dieselControlChangedAt: toIsoString(company.dieselControlChangedAt),
    operationalCenterPostalCode: company.operationalCenterPostalCode ?? undefined,
    operationalCenterCityMunicipality:
      company.operationalCenterCityMunicipality ?? undefined,
    operationalCenterLocality: company.operationalCenterLocality ?? undefined,
    operationalCenterSettlementConsId:
      company.operationalCenterSettlementConsId ?? undefined,
    operationalCenterLatitude: dbCoordToApi(company.operationalCenterLatitude),
    operationalCenterLongitude: dbCoordToApi(company.operationalCenterLongitude),
  };
}
