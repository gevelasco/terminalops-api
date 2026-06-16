import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateActualScheduleDto {
  @ApiPropertyOptional({ description: 'Salida real (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  departureAt?: string;

  @ApiPropertyOptional({ description: 'Llegada real con cliente (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  arrivedAt?: string;

  @ApiPropertyOptional({ description: 'Fin real de maniobra (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  returnAt?: string;

  @ApiPropertyOptional({ description: 'Justificación del cambio (obligatoria si hay deltas)' })
  @IsOptional()
  @IsString()
  justification?: string;
}
