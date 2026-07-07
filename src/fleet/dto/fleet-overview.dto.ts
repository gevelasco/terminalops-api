export type FleetOverviewEquipmentConvoyType =
  | 'trailer'
  | 'none'
  | 'single'
  | 'full';

export type FleetOverviewAssetStatus =
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'scheduled';

export type FleetOverviewOperationalStatus =
  | 'in_transit'
  | 'scheduled'
  | 'available'
  | 'maintenance';

export type FleetOverviewTripStatus = 'in_transit' | 'scheduled' | 'completed';

export type FleetOverviewRenewalStatus = 'ok' | 'soon' | 'due' | 'na';

export class FleetOverviewEquipmentDto {
  equipmentId: number | null;
  type: FleetOverviewEquipmentConvoyType;
  status: FleetOverviewAssetStatus;
}

export class FleetOverviewHitchedEquipmentDto {
  equipmentId: number;
  operationalCode: string;
  /** Nombre o alias interno (campo `name` en alta). */
  alias?: string;
  equipmentType: string;
  hitchPosition?: 'lead' | 'rear';
  status: FleetOverviewAssetStatus;
}

export class FleetOverviewTripDto {
  tripId: number;
  maneuverCode: string;
  clientName: string;
  /** Ruta compacta lista para UI: «Ciudad, Estado → Ciudad, Estado». */
  origin: string;
  destination: string;
  status: FleetOverviewTripStatus;
  plannedDepartureAt?: string;
  plannedArrivalAt?: string;
  plannedCompletionAt?: string;
  departureAt?: string;
  arrivedAt?: string;
  returnAt?: string;
  /** Km operativos ida + vuelta (mismo criterio que maniobras). */
  operationalDistanceKm?: number;
  operatorName?: string;
}

export class FleetOverviewMaintenanceDto {
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  kmSinceLastMaintenance?: number;
  tireStatus?: string;
  insuranceStatus?: string;
  inspectionStatus?: string;
  maintenanceRenewal?: FleetOverviewRenewalStatus;
  insuranceRenewal?: FleetOverviewRenewalStatus;
  inspectionRenewal?: FleetOverviewRenewalStatus;
}

export class FleetOverviewConfigurationDto {
  id: number;
  code: string;
  name: string;
  maxEquipmentCount: number;
}

export class FleetOverviewItemDto {
  unitId: number;
  unitName: string;
  /** Nombre o alias interno de la unidad (campo `name` en alta). */
  unitAlias?: string;
  unitPlate: string;
  equipment: FleetOverviewEquipmentDto;
  hitchedEquipment: FleetOverviewHitchedEquipmentDto[];
  operationalStatus: FleetOverviewOperationalStatus;
  trip?: FleetOverviewTripDto;
  maintenance?: FleetOverviewMaintenanceDto;
  configuration?: FleetOverviewConfigurationDto;
  /** Días sin maniobra (solo unidades disponibles). */
  daysWithoutManeuver?: number;
}

export class FleetOverviewEquipmentRowDto {
  equipmentId: number;
  unitId: number | null;
  unitName: string | null;
  operationalCode: string;
  /** Nombre o alias interno (campo `name` en alta). */
  alias?: string;
  brand: string;
  model: string;
  plate: string;
  equipmentType: string;
  operationalStatus: FleetOverviewOperationalStatus;
  maintenance?: FleetOverviewMaintenanceDto;
}

export class FleetOverviewResponseDto {
  items: FleetOverviewItemDto[];
  equipment: FleetOverviewEquipmentRowDto[];
}
