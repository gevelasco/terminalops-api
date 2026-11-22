export type TripMapGeoPointSource =
  | 'destination_rate'
  | 'client_delivery'
  | 'operational_center'
  | 'fallback'
  | 'unresolved';

export type TripMapGeoQuality = 'resolved' | 'partial' | 'unresolved';

export type TripMapStatus = 'scheduled' | 'in_transit';

export interface TripMapGeoPointDto {
  lat: number | null;
  lng: number | null;
  label: string;
  source: TripMapGeoPointSource;
}

/** Intermedios de la tarifa de destino (solo geometría de ruta en mapa). */
export interface TripMapRouteWaypointDto {
  lat: number;
  lon: number;
}

/** Casetas persistidas en tarifa (coordenadas para OSRM; no se pintan en mapa de maniobras). */
export interface TripMapRouteTollPlazaDto {
  order: number;
  plazaKey: string;
  inegiPoint?: string;
  name: string;
}

export interface TripMapItemDto {
  id: string;
  maneuverCode: string;
  status: TripMapStatus;
  origin: TripMapGeoPointDto;
  destination: TripMapGeoPointDto;
  geoQuality: TripMapGeoQuality;
  routeWaypoints?: TripMapRouteWaypointDto[];
  routeTollPlazas?: TripMapRouteTollPlazaDto[];
}

export interface TripsMapMetaDto {
  total: number;
  resolved: number;
  partial: number;
  unresolved: number;
}

export interface TripsMapResponseDto {
  items: TripMapItemDto[];
  meta: TripsMapMetaDto;
}
