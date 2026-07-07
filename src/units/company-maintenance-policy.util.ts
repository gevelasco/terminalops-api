import type { Company } from 'src/companies/entities/company.entity';
import { parseStoredKm } from './unit-trip-odometer.util';

export type MaintenanceDatePeriod = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export type CompanyMaintenancePolicyContext = {
  kmControlEnabled: boolean;
  kmIntervalDefault: number | null;
  dateControlEnabled: boolean;
  datePeriodMonths: number;
};

const DEFAULT_DATE_PERIOD_MONTHS = 6;

export function maintenanceDatePeriodToMonths(
  period: MaintenanceDatePeriod | string | null | undefined,
): number {
  switch (period) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
    default:
      return DEFAULT_DATE_PERIOD_MONTHS;
  }
}

export function companyMaintenancePolicyContext(
  company: Pick<
    Company,
    | 'maintenanceKmControlEnabled'
    | 'maintenanceKmIntervalDefault'
    | 'maintenanceDateControlEnabled'
    | 'maintenanceDatePeriodDefault'
  > | null | undefined,
): CompanyMaintenancePolicyContext {
  const kmControlEnabled = company?.maintenanceKmControlEnabled === true;
  const kmIntervalDefault = kmControlEnabled
    ? parseStoredKm(company?.maintenanceKmIntervalDefault)
    : null;
  const dateControlEnabled =
    company?.maintenanceDateControlEnabled === true && !kmControlEnabled;
  return {
    kmControlEnabled,
    kmIntervalDefault,
    dateControlEnabled,
    datePeriodMonths: maintenanceDatePeriodToMonths(
      company?.maintenanceDatePeriodDefault,
    ),
  };
}

export function maintenanceKmRemainingFromCounter(
  counter: number | null | undefined,
  interval: number | null | undefined,
): number | null {
  if (interval == null || interval <= 0) {
    return null;
  }
  const c = counter ?? 0;
  return Math.max(0, interval - c);
}
