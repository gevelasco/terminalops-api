import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class FuelEstimateRequestDto {
  @ApiProperty({ description: 'Distancia OSRM en km (solo ida)' })
  @IsNumber()
  @Min(0.1)
  distanceKm: number;

  @ApiPropertyOptional({
    description: 'Si true (default), estima ida y vuelta (distanceKm × 2)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isRoundTrip?: boolean;

  @ApiProperty({ enum: ['sencillo', 'full'] })
  @IsIn(['sencillo', 'full'])
  configuration: 'sencillo' | 'full';

  @ApiProperty({ description: 'Peso aproximado en toneladas' })
  @IsNumber()
  @Min(0)
  approximateWeightTons: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  cargoType?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  containerType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  unitId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  equipment1Id?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  equipment2Id?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  originLatitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  originLongitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  destinationLatitude?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  destinationLongitude?: number | null;
}

export class FuelEstimateAdjustmentsDto {
  @ApiProperty()
  weightFactor: number;

  @ApiProperty()
  configurationFactor: number;

  @ApiProperty()
  routeFactor: number;

  @ApiProperty({ description: '1 = solo ida; 2 = ida y vuelta' })
  roundTripFactor: number;

  @ApiProperty({ description: 'Km usados en el cálculo de litros' })
  effectiveDistanceKm: number;
}

export class FuelEstimateResponseDto {
  @ApiProperty({ description: 'Distancia OSRM (solo ida)' })
  routeDistanceKm: number;

  @ApiProperty({ description: 'Distancia operativa (ida + vuelta por defecto)' })
  operationalDistanceKm: number;

  @ApiProperty()
  estimatedLiters: number;

  @ApiProperty()
  estimatedKmPerLiter: number;

  @ApiProperty()
  estimatedDieselCost: number;

  @ApiProperty()
  dieselPricePerLiter: number;

  @ApiProperty()
  calculationProfile: string;

  @ApiProperty({ type: FuelEstimateAdjustmentsDto })
  adjustments: FuelEstimateAdjustmentsDto;
}
