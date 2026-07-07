import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTripDto } from './create-trip.dto';

const TRIP_SNAPSHOT_IMMUTABLE_FIELDS = [
  'origin',
  'destination',
  'originPostalCode',
  'originCityMunicipality',
  'originLocality',
  'destinationPostalCode',
  'destinationCityMunicipality',
  'destinationLocality',
  'destinationRateId',
  'routeDistanceKm',
  'originOperationalCenterId',
] as const satisfies readonly (keyof CreateTripDto)[];

/** PATCH parcial sin campos snapshot de ruta/tarifa (A4). */
export class UpdateTripDto extends PartialType(
  OmitType(CreateTripDto, [...TRIP_SNAPSHOT_IMMUTABLE_FIELDS]),
) {}
