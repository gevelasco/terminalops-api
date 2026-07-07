import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  EXPENSE_MAINTENANCE_TARGETS,
  EXPENSE_VERIFICATION_SCOPES,
} from '../expense-payload.util';

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
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Proveedor, aseguradora, taller…' })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({ description: 'Método de pago (valor de catálogo UI)' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ enum: EXPENSE_MAINTENANCE_TARGETS })
  @IsOptional()
  @IsIn(EXPENSE_MAINTENANCE_TARGETS)
  maintenanceTarget?: (typeof EXPENSE_MAINTENANCE_TARGETS)[number];

  @ApiPropertyOptional({ enum: EXPENSE_MAINTENANCE_TARGETS })
  @IsOptional()
  @IsIn(EXPENSE_MAINTENANCE_TARGETS)
  insuranceTarget?: (typeof EXPENSE_MAINTENANCE_TARGETS)[number];

  @ApiPropertyOptional({ enum: EXPENSE_VERIFICATION_SCOPES })
  @IsOptional()
  @IsIn(EXPENSE_VERIFICATION_SCOPES)
  verificationScope?: (typeof EXPENSE_VERIFICATION_SCOPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  invoiceRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOperationalProvision?: boolean;
}
