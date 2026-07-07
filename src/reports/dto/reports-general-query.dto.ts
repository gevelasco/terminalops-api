import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReportsGeneralQueryDto {
  @IsDateString()
  @ApiProperty({ example: '2026-06-01' })
  from!: string;

  @IsDateString()
  @ApiProperty({ example: '2026-06-19' })
  to!: string;

  /** IDs numéricos separados por coma; vacío = todos. */
  @IsOptional()
  @IsString()
  clientIds?: string;

  /** Valores `Trip.paymentMethod` separados por coma; vacío = todos. */
  @IsOptional()
  @IsString()
  paymentMethods?: string;
}
