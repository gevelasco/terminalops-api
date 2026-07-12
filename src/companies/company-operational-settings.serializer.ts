import { Company } from 'src/companies/entities/company.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';
import { operationalCenterGeoForApi } from 'src/operational-centers/operational-center-geo-for-api';
import { normalizeExpensePaymentMethod } from 'src/expenses/expense-payment-method.util';
import type { OperationalCenter } from 'src/operational-centers/entities/operational-center.entity';

function dbNumToApi(value?: string | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function serializeCompanyOperationalSettings(
  company: Company,
  primaryCenter: OperationalCenter,
) {
  const geo = operationalCenterGeoForApi(primaryCenter);
  return {
    id: company.id,
    name: company.name,
    operationalCenterName: geo.operationalCenterName,
    operationalAnalysisEnabled: company.operationalAnalysisEnabled,
    operationalAnalysisChangedAt: toIsoString(company.operationalAnalysisChangedAt),
    tripAssistPrefillEnabled: company.tripAssistPrefillEnabled,
    tripAssistPrefillChangedAt: toIsoString(company.tripAssistPrefillChangedAt),
    tripAutoMaintenanceProvisionPercent: dbNumToApi(
      company.tripAutoMaintenanceProvisionPercent,
    ) ?? 5,
    tripAutoFuelPaymentMethod: normalizeExpensePaymentMethod(
      company.tripAutoFuelPaymentMethod,
    ),
    tripAutoTollsPaymentMethod: normalizeExpensePaymentMethod(
      company.tripAutoTollsPaymentMethod,
    ),
    tripAutoPerDiemPaymentMethod: normalizeExpensePaymentMethod(
      company.tripAutoPerDiemPaymentMethod,
    ),
    tripAutoControlPaymentMethod: normalizeExpensePaymentMethod(
      company.tripAutoControlPaymentMethod,
    ),
    maintenanceKmControlEnabled: company.maintenanceKmControlEnabled,
    maintenanceKmIntervalDefault: dbNumToApi(company.maintenanceKmIntervalDefault),
    maintenanceKmControlChangedAt: toIsoString(company.maintenanceKmControlChangedAt),
    maintenanceDateControlEnabled: company.maintenanceDateControlEnabled,
    maintenanceDatePeriodDefault: company.maintenanceDatePeriodDefault ?? undefined,
    maintenanceDateControlChangedAt: toIsoString(company.maintenanceDateControlChangedAt),
    dieselControlEnabled: company.dieselControlEnabled,
    dieselControlChangedAt: toIsoString(company.dieselControlChangedAt),
    operationalCenterPostalCode: geo.operationalCenterPostalCode,
    operationalCenterCityMunicipality: geo.operationalCenterCityMunicipality,
    operationalCenterLocality: geo.operationalCenterLocality,
    operationalCenterSettlementConsId: geo.operationalCenterSettlementConsId,
    operationalCenterLatitude: geo.operationalCenterLatitude,
    operationalCenterLongitude: geo.operationalCenterLongitude,
  };
}
