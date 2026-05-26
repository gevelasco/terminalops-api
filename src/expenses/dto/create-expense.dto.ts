import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty()
  @IsDateString()
  incurredAt: string;

  @ApiProperty()
  @IsString()
  kind: string;

  @ApiPropertyOptional({ description: 'ID público numérico de la maniobra' })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiPropertyOptional({ default: 'MXN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'ID público numérico de la unidad' })
  @IsOptional()
  @IsString()
  relatedUnitId?: string;

  @ApiPropertyOptional({ description: 'ID público numérico del equipo' })
  @IsOptional()
  @IsString()
  relatedEquipmentId?: string;

  @ApiPropertyOptional({ description: 'ID público numérico del operador' })
  @IsOptional()
  @IsString()
  relatedOperatorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOperationalProvision?: boolean;
}
