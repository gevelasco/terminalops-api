export type DashboardDailyExpenseRubroDto = {
  rubro: string;
  label: string;
  amount: number;
  count: number;
};

export type DashboardDailyPeriodDistributionDto = {
  collectedRevenue: number;
  receivableRevenue: number;
  expensesByRubro: DashboardDailyExpenseRubroDto[];
};

export type DashboardDailyResultDto = {
  revenue: number;
  expenses: number;
  margin: number;
  completedTripsCount: number;
  expensesCount: number;
  periodDistribution: DashboardDailyPeriodDistributionDto;
};

export type DashboardDieselSnapshotDto = {
  enabled: boolean;
  pricePerLiter: number | null;
  suggestedPricePerLiter: number | null;
  source: 'company' | 'suggested' | null;
  updatedAt: string | null;
};

export type DashboardSummaryDto = {
  asOf: string;
  operationalDate: string;
  tripsInTransit: number;
  tripsInTransitDestinations: number;
  unitsAvailable: number;
  equipmentAvailable: number;
  tripsScheduled: number;
  tripsScheduledWeekOverWeekPercent: number | null;
  nextScheduledDepartureAt: string | null;
  dailyResult: DashboardDailyResultDto;
  diesel: DashboardDieselSnapshotDto;
};
