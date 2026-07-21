import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OptionalIsoDate } from 'src/common/decorators/optional-iso-date.decorator';

export class CreateEquipmentFleetMaintenanceEntryDto {
  @ApiPropertyOptional()
  @OptionalIsoDate()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class CreateEquipmentFleetVerificationEntryDto {
  @ApiPropertyOptional({ enum: ['phys_mech'] })
  @IsOptional()
  @IsIn(['phys_mech'])
  scope?: 'phys_mech';

  @ApiPropertyOptional()
  @OptionalIsoDate()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class CreateEquipmentFleetMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerBrandName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trailerColor?: string;

  @ApiPropertyOptional({ enum: ['owned', 'financed', 'leased', 'managed'] })
  @IsOptional()
  @IsIn(['owned', 'financed', 'leased', 'managed'])
  trailerTenureMode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  trailerCommercialValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  trailerRecurringPaymentAmount?: number;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  trailerRecurringPaymentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  trailerRecurringInstallmentCount?: number;

  @ApiPropertyOptional({ enum: ['monthly', 'quarterly', 'annual'] })
  @IsOptional()
  @IsIn(['monthly', 'quarterly', 'annual'])
  trailerRecurringPaymentCadence?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  trailerRecurringLastPaymentDate?: string;

  @ApiPropertyOptional({ description: 'Beneficiario de cuotas de financiamiento o arrendamiento' })
  @IsOptional()
  @IsString()
  trailerTenureBeneficiary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  trailerManagementOwnerPayout?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipmentCapacityTons?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  equipmentAxleCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipmentContainerSlotConfig?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  equipmentTireCount?: number;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Derivado de maintenanceEntries al leer; no se persiste en profile.',
  })
  @OptionalIsoDate()
  lastMaintenanceDate?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Derivado de maintenanceEntries al leer; no se persiste en profile.',
  })
  @IsOptional()
  @IsString()
  lastMaintenanceType?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Derivado de maintenanceEntries al leer; no se persiste en profile.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lastMaintenanceCost?: number;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Derivado de maintenanceEntries al leer; no se persiste en profile.',
  })
  @IsOptional()
  @IsString()
  lastMaintenanceNotes?: string;

  @ApiPropertyOptional({ type: [CreateEquipmentFleetMaintenanceEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEquipmentFleetMaintenanceEntryDto)
  maintenanceEntries?: CreateEquipmentFleetMaintenanceEntryDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tireCondition?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignorado en escritura.',
  })
  @IsOptional()
  @IsBoolean()
  maintenanceAlertByKm?: boolean;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Ignorado en escritura; próximo mantenimiento se calcula en vivo.',
  })
  @OptionalIsoDate()
  maintenanceNextDateOverride?: string;

  /** @deprecated Ignorado en escritura. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceKmInterval?: number;

  /** @deprecated Ignorado en escritura. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceTripKmAtLastService?: number;

  /** @deprecated Ignorado en escritura. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceKmRemaining?: number;

  @ApiPropertyOptional({ type: [CreateEquipmentFleetVerificationEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEquipmentFleetVerificationEntryDto)
  verificationEntries?: CreateEquipmentFleetVerificationEntryDto[];

  @ApiPropertyOptional({
    description:
      'Compat FE: se convierte a verificationEntries al guardar si no se envía el array.',
  })
  @OptionalIsoDate()
  verificationPhysMechDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  verificationPhysMechCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insurancePolicyNumber?: string;

  @ApiPropertyOptional({ description: 'Aseguradora o nombre comercial del seguro' })
  @IsOptional()
  @IsString()
  insuranceCarrierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  insurancePaymentCadence?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  insuranceContractDate?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  insuranceLastPaymentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  insuranceCost?: number;

  @ApiPropertyOptional({ description: 'Código de forma de pago (transfer, cash, check…)' })
  @IsOptional()
  @IsString()
  insurancePaymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  insuranceInvoiceRequired?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentMaintenanceNames?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentVerificationNames?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentPolicyNames?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentOwnershipNames?: string[];
}

