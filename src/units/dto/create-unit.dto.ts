import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateUnitFleetMetaDto } from './create-unit-fleet-meta.dto';

const UNIT_TRANSPORT_TYPES = [
  'tractocamion',
  'rabon_plataforma',
  'camion_pipa',
  'maroma_volteo',
] as const;

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  plate: string;

  @ApiPropertyOptional({
    description: 'Configuración del vehículo motriz de carga',
    example: 'tractocamion',
    enum: UNIT_TRANSPORT_TYPES,
  })
  @IsOptional()
  @IsIn(UNIT_TRANSPORT_TYPES)
  transportType?: (typeof UNIT_TRANSPORT_TYPES)[number];

  @ApiProperty()
  @IsNumber()
  @Min(0)
  capacityKg: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motorNumber?: string;

  @ApiPropertyOptional({
    description: 'Capacidad en toneladas (se persiste como capacity_kg ×1000).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityTons?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerBrandAbbr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerYear?: string;

  @ApiPropertyOptional({ type: CreateUnitFleetMetaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateUnitFleetMetaDto)
  fleetMeta?: CreateUnitFleetMetaDto;
}
