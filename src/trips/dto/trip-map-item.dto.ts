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

export interface TripMapItemDto {
  id: string;
  maneuverCode: string;
  status: TripMapStatus;
  origin: TripMapGeoPointDto;
  destination: TripMapGeoPointDto;
  geoQuality: TripMapGeoQuality;
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
