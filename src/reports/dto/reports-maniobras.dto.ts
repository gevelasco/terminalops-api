export type ReportsManiobrasSummaryDto = {
  from: string;
  to: string;
  completedTripsCount: number;
  completedTripsPriorPeriodPercent: number | null;
  tripsInTransit: number;
  tripsScheduledInPeriod: number;
  cancelledTripsCount: number;
  delayedTripsCount: number;
  totalOperationalKm: number;
  avgKmPerTrip: number;
  avgManeuverDurationDays: number;
  uniqueDestinations: number;
};

export type ReportsManiobrasVolumePointDto = {
  date: string;
  completed: number;
  inTransit: number;
  scheduled: number;
  cancelled: number;
};

export type ReportsManiobrasRecurringIncidentRouteDto = {
  destination: string;
  /** Maniobras distintas con al menos un incidente en el destino (cada una cuenta 1). */
  incidentCount: number;
  maneuverCodes: string[];
  lastIncidentAt: string | null;
};

export type ReportsManiobrasOperatorRowDto = {
  operatorName: string;
  completed: number;
  operationalKm: number;
};

export type ReportsManiobrasClientRowDto = {
  clientName: string;
  tripCount: number;
};

export type ReportsManiobrasDestinationRowDto = {
  destination: string;
  tripCount: number;
};

export type ReportsManiobrasContainerTypeRowDto = {
  containerType: string;
  label: string;
  tripCount: number;
};

export type ReportsManiobrasCargoWeightRowDto = {
  containerType: string;
  label: string;
  tripCount: number;
  avgWeightTons: number;
};

export type ReportsManiobrasGeoMapTripDto = {
  tripId: number;
  maneuverCode: string;
  status: 'scheduled' | 'in_transit' | 'completed' | 'cancelled';
  operatorName: string;
  clientName: string;
  durationDays: number | null;
  lat: number | null;
  lng: number | null;
};

export type ReportsManiobrasInsightsDto = {
  recurringIncidentRoutes: ReportsManiobrasRecurringIncidentRouteDto[];
  topOperators: ReportsManiobrasOperatorRowDto[];
  topClients: ReportsManiobrasClientRowDto[];
  topDestinations: ReportsManiobrasDestinationRowDto[];
  containerTypeMix: ReportsManiobrasContainerTypeRowDto[];
  cargoWeightByContainer: ReportsManiobrasCargoWeightRowDto[];
  geoMapTrips: ReportsManiobrasGeoMapTripDto[];
};

export type ReportsManiobrasDto = {
  summary: ReportsManiobrasSummaryDto;
  insights: ReportsManiobrasInsightsDto;
};
