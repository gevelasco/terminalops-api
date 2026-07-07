import type { DashboardInsightsDto } from '../../dashboard/dto/dashboard-insights.dto';
import type { ReportsManiobrasOperatorRowDto } from './reports-maniobras.dto';

export type ReportsGeneralSummaryDto = {
  from: string;
  to: string;
  completedTripsCount: number;
  completedTripsPriorPeriodPercent: number | null;
  completedTripsDailyAvg: number;
  revenue: number;
  avgRevenuePerTrip: number;
  expenses: number;
  expensesCount: number;
  margin: number;
  tripsInTransit: number;
  tripsScheduledInPeriod: number;
  unitsUsed: number;
};

export type ReportsGeneralExpenseRubroDto = {
  rubro: string;
  label: string;
  amount: number;
  count: number;
};

export type ReportsGeneralPeriodDistributionDto = {
  collectedRevenue: number;
  receivableRevenue: number;
  expensesByRubro: ReportsGeneralExpenseRubroDto[];
};

export type ReportsGeneralInsightsDto = Pick<
  DashboardInsightsDto,
  'tripActivity' | 'operationalFlow' | 'topDestinations' | 'operationMix' | 'operationMixTotal'
> & {
  periodDistribution: ReportsGeneralPeriodDistributionDto;
  topOperators: ReportsManiobrasOperatorRowDto[];
};

export type ReportsGeneralDto = {
  summary: ReportsGeneralSummaryDto;
  insights: ReportsGeneralInsightsDto;
};
