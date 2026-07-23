export type ReportsManiobrasSummaryDto = {
  from: string;
  to: string;
  completedTripsCount: number;
  completedTripsPriorPeriodPercent: number | null;
  tripsInTransit: number;
  tripsScheduledInPeriod: number;
  cancelledTripsCount: number;
  /** Horas totales de ralenti (exceso vs baseline plan/tarifa). */
  ralentiHoursTotal: number;
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

export type ReportsManiobrasRalentiLeg = 'salida_cliente' | 'cliente_regreso';

export type ReportsManiobrasRalentiByClientDto = {
  clientName: string;
  salidaClienteHours: number;
  clienteRegresoHours: number;
  totalHours: number;
};

export type ReportsManiobrasRalentiEventDto = {
  tripId: number;
  maneuverCode: string;
  clientName: string;
  destination: string;
  leg: ReportsManiobrasRalentiLeg;
  plannedHours: number;
  actualHours: number;
  baselineHours: number;
  baselineSource: 'rate' | 'planned';
  ralentiHours: number;
};

export type ReportsManiobrasRalentiDto = {
  salidaClienteHours: number;
  clienteRegresoHours: number;
  tripsEvaluated: number;
  tripsWithRalenti: number;
  byClient: ReportsManiobrasRalentiByClientDto[];
  events: ReportsManiobrasRalentiEventDto[];
};

export type ReportsManiobrasInsightsDto = {
  recurringIncidentRoutes: ReportsManiobrasRecurringIncidentRouteDto[];
  topOperators: ReportsManiobrasOperatorRowDto[];
  topClients: ReportsManiobrasClientRowDto[];
  topDestinations: ReportsManiobrasDestinationRowDto[];
  containerTypeMix: ReportsManiobrasContainerTypeRowDto[];
  cargoWeightByContainer: ReportsManiobrasCargoWeightRowDto[];
  geoMapTrips: ReportsManiobrasGeoMapTripDto[];
  ralenti: ReportsManiobrasRalentiDto;
};

export type ReportsManiobrasDto = {
  summary: ReportsManiobrasSummaryDto;
  insights: ReportsManiobrasInsightsDto;
};
