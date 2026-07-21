import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { CreateTripDto } from './create-trip.dto';

const TRIP_SNAPSHOT_IMMUTABLE_FIELDS = [
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
) {
  @ApiPropertyOptional({
    description:
      'Justificación obligatoria al actualizar fechas de una maniobra programada',
  })
  @IsOptional()
  @IsString()
  plannedDatesJustification?: string;

  @ApiPropertyOptional({
    description:
      'Entrega de vacío: fecha/hora ISO 8601 (no puede ser menor al fin planeado ni al fin real)',
  })
  @IsOptional()
  @IsDateString()
  emptyDeliveryAt?: string;

  @ApiPropertyOptional({
    description: 'Entrega de vacío: lugar (catálogo de lugares por empresa)',
  })
  @IsOptional()
  @IsString()
  emptyDeliveryPlace?: string;

  @ApiPropertyOptional({
    description:
      'Justificación obligatoria al modificar una entrega de vacío ya registrada',
  })
  @IsOptional()
  @IsString()
  emptyDeliveryJustification?: string;
}
