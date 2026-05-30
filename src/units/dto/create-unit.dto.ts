import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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

  @ApiProperty()
  @IsString()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

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
