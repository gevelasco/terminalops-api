import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateOperationConfigurationDto {
  @ApiProperty({ example: 'Cama baja' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'cama-baja' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ default: 1, description: 'Equipos asignables en maniobra' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  maxEquipmentCount?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
