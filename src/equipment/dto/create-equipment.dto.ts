import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateEquipmentFleetMetaDto } from 'src/equipment/dto/create-equipment-fleet-meta.dto';

export class CreateEquipmentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  serialNumber: string;

  @ApiPropertyOptional({
    description: 'ID público numérico de la unidad; null desengancha',
    nullable: true,
  })
  @IsOptional()
  unitId?: string | null;

  @ApiPropertyOptional({
    enum: ['lead', 'rear'],
    description: 'Posición en convoy: lead delantero, rear trasero (full)',
  })
  @IsOptional()
  @IsIn(['lead', 'rear'])
  hitchPosition?: 'lead' | 'rear' | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerBrandAbbr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerYear?: string;

  @ApiPropertyOptional({ type: CreateEquipmentFleetMetaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateEquipmentFleetMetaDto)
  fleetMeta?: CreateEquipmentFleetMetaDto;
}
