import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OptionalIsoDate } from 'src/common/decorators/optional-iso-date.decorator';
import { EXPENSE_VERIFICATION_SCOPES } from '../expense-payload.util';

export class CreateExpenseDocumentDto {
  @ApiPropertyOptional({ description: 'ID numérico del documento (si ya existe)' })
  @IsOptional()
  @Transform(({ value }) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  })
  @IsInt()
  id?: number;

  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty({ enum: ['receipt'] })
  @IsIn(['receipt'])
  slot: string;

  @ApiPropertyOptional({ description: 'ISO date YYYY-MM-DD' })
  @OptionalIsoDate()
  addedAt?: string;
}

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

  /** Solo create de verificación: se traduce a category canónica. */
  @ApiPropertyOptional({ enum: EXPENSE_VERIFICATION_SCOPES })
  @IsOptional()
  @IsIn(EXPENSE_VERIFICATION_SCOPES)
  verificationScope?: (typeof EXPENSE_VERIFICATION_SCOPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  invoiceRequired?: boolean;

  @ApiPropertyOptional({ description: 'Fecha en que se pagó (ISO). null = pendiente.' })
  @IsOptional()
  @IsDateString()
  paidAt?: string | null;

  @ApiPropertyOptional({ type: [CreateExpenseDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseDocumentDto)
  documents?: CreateExpenseDocumentDto[];
}
