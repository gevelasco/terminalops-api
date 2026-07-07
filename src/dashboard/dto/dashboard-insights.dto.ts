export type DashboardOperationalFlowPointDto = {
  date: string;
  trips: number;
  expenses: number;
  revenue: number;
};

export type DashboardTripActivityPointDto = {
  date: string;
  completed: number;
  inTransit: number;
  scheduled: number;
};

export type DashboardTopDestinationDto = {
  destination: string;
  tripCount: number;
};

export type DashboardRecentTripDto = {
  id: number;
  status: string;
  falseManeuver: boolean;
  operatorName: string;
  destination: string;
  clientCharge: string | null;
};

export type DashboardOperationMixSliceDto = {
  operationType: string;
  label: string;
  count: number;
};

export type DashboardInsightsDto = {
  operationalFlow: DashboardOperationalFlowPointDto[];
  tripActivity: DashboardTripActivityPointDto[];
  topDestinations: DashboardTopDestinationDto[];
  recentTrips: DashboardRecentTripDto[];
  operationMix: DashboardOperationMixSliceDto[];
  operationMixTotal: number;
};
