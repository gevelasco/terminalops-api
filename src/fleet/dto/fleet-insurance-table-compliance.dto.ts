import type { FleetOverviewRenewalStatus } from './fleet-overview.dto';

export type FleetTableInsuranceComplianceDto = {
  renewal: FleetOverviewRenewalStatus;
  nextLabel: string | null;
};

export type FleetInsuranceTableComplianceResponseDto = {
  units: Record<string, FleetTableInsuranceComplianceDto>;
  equipment: Record<string, FleetTableInsuranceComplianceDto>;
};
