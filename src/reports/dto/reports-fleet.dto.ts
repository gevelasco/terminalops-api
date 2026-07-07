import type { FleetOverviewOperationalStatus } from 'src/fleet/dto/fleet-overview.dto';
import type { FleetOverviewRenewalStatus } from 'src/fleet/dto/fleet-overview.dto';

export type ReportsFleetSummaryDto = {
  from: string;
  to: string;
  totalOperationalKm: number;
  totalDieselLiters: number;
  totalDieselAmount: number;
  maintenanceEventsInPeriod: number;
  maintenanceSpendInPeriod: number;
  avgDaysWithoutOperation: number;
};

export type ReportsFleetStatusMixRowDto = {
  status: FleetOverviewOperationalStatus;
  label: string;
  count: number;
};

export type ReportsFleetUnitActivityRowDto = {
  unitLabel: string;
  completedTrips: number;
  operationalKm: number;
  dieselLiters: number;
};

export type ReportsFleetMaintenanceEventRowDto = {
  assetLabel: string;
  assetKind: 'unit' | 'equipment';
  entryDate: string | null;
  entryType: string;
  status: string;
  cost: number;
};

export type ReportsFleetComplianceUnitRowDto = {
  unitCode: string;
  unitId: number;
  maintenanceRenewal: FleetOverviewRenewalStatus;
  maintenanceNext: string | null;
  verificationRenewal: FleetOverviewRenewalStatus;
  verificationNext: string | null;
  insuranceRenewal: FleetOverviewRenewalStatus;
  insuranceNext: string | null;
};

export type ReportsFleetTireWearRowDto = {
  unitCode: string;
  tripCount: number;
  operationalKm: number;
  avgWeightTons: number;
  tireWearMxn: number;
  tireCpkMxn: number;
  tireLifeUsedPercent: number;
};

export type ReportsFleetUnitProfitabilityRowDto = {
  unitLabel: string;
  revenue: number;
  diesel: number;
  operator: number;
  tolls: number;
  maintenance: number;
  tires: number;
  netMargin: number;
  marginPercent: number | null;
};

export type ReportsFleetInsightsDto = {
  statusMix: ReportsFleetStatusMixRowDto[];
  topUnitsByKm: ReportsFleetUnitActivityRowDto[];
  maintenanceEvents: ReportsFleetMaintenanceEventRowDto[];
  complianceUnits: ReportsFleetComplianceUnitRowDto[];
  tireWearByUnit: ReportsFleetTireWearRowDto[];
  unitProfitability: ReportsFleetUnitProfitabilityRowDto[];
};

export type ReportsFleetDto = {
  summary: ReportsFleetSummaryDto;
  insights: ReportsFleetInsightsDto;
};
