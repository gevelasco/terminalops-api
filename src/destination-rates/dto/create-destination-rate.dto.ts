import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { DestinationRatePriceInputDto } from './destination-rate-price-input.dto';
import { RouteWaypointInputDto } from './route-waypoint-input.dto';

export class CreateDestinationRateDto {
  @ApiProperty({ description: 'ID público del centro operativo de origen' })
  @IsString()
  originOperationalCenterId: string;

  @ApiProperty({ example: '77560' })
  @IsString()
  @Length(5, 5)
  postalCode: string;

  @ApiProperty({ example: 'Cancún, Quintana Roo' })
  @IsString()
  cityMunicipality: string;

  @ApiProperty({ example: 'Alfredo V. Bonfil' })
  @IsString()
  locality: string;

  @ApiProperty({ type: [DestinationRatePriceInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DestinationRatePriceInputDto)
  prices: DestinationRatePriceInputDto[];

  @ApiPropertyOptional({ description: 'Distancia OSRM (solo ida)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  routeDistanceKm?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Ignorado: las maniobras siempre son ida+vuelta (×2).',
  })
  @IsOptional()
  @IsBoolean()
  isRoundTrip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  destinationLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  destinationLongitude?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Referencia UX: tiempo salida → llegada cliente',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedArrivalTimeValue?: number | null;

  @ApiPropertyOptional({
    description: 'Referencia UX: tiempo llegada cliente → regreso',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedReturnTimeValue?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Claves INEGI de casetas excluidas en esta ruta (por libre).',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedTollPlazaKeys?: string[];

  @ApiPropertyOptional({
    description:
      'Puntos intermedios de la ruta personalizada (orden de recorrido).',
    type: [RouteWaypointInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteWaypointInputDto)
  routeWaypoints?: RouteWaypointInputDto[];

  @ApiPropertyOptional({
    description: 'Casetas en ruta para esta tarifa (misma lista que al guardar).',
    type: 'array',
    items: { type: 'object' },
  })
  @IsOptional()
  @IsArray()
  routeTollPlazas?: Record<string, unknown>[];
}
