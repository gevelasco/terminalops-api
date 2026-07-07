import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateUnitFleetMetaDto } from './create-unit-fleet-meta.dto';

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  plate: string;

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

  @ApiPropertyOptional()
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
