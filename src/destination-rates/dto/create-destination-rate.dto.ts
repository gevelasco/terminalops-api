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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DestinationRatePriceInputDto } from './destination-rate-price-input.dto';
import { RouteWaypointInputDto } from './route-waypoint-input.dto';

export class CreateDestinationRateDto {
  @ApiProperty({ description: 'ID público del centro operativo de origen' })
  @IsString()
  originOperationalCenterId: string;

  @ApiPropertyOptional({ example: '77560' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Length(5, 5)
  postalCode?: string;

  @ApiProperty({ example: 'Cancún, Quintana Roo' })
  @IsString()
  cityMunicipality: string;

  @ApiPropertyOptional({ example: 'Alfredo V. Bonfil' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({ example: 'Zapopan' })
  @IsOptional()
  @IsString()
  municipalityName?: string;

  @ApiPropertyOptional({ example: 'Jalisco' })
  @IsOptional()
  @IsString()
  stateName?: string;

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
