import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class DestinationRatePriceInputDto {
  @ApiPropertyOptional({ description: 'ID de configuración operacional existente' })
  @IsOptional()
  @IsString()
  operationConfigurationId?: string;

  @ApiPropertyOptional({
    description: 'Nombre para crear/reutilizar configuración operacional',
  })
  @IsOptional()
  @IsString()
  operationConfigurationName?: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(0)
  clientCharge: number;

  @ApiProperty({ example: 350 })
  @IsNumber()
  @Min(0)
  operatorPaymentEstimate: number;

  @ApiPropertyOptional({ example: 420, description: 'Casetas aproximadas (MXN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedTollAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
