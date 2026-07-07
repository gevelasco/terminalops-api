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

export class CreateUnitFleetMaintenanceEntryDto {
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentNames?: string[];

  @ApiPropertyOptional({ enum: ['concluido'] })
  @IsOptional()
  @IsIn(['concluido'])
  status?: 'concluido';
}

export class CreateUnitFleetMetaDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceModality?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  trailerManagementOwnerPayout?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transmissionType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transmissionSpeeds?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  grossVehicleWeightLb?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  odometerKm?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  lastMaintenanceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastMaintenanceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  lastMaintenanceCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastMaintenanceNotes?: string;

  @ApiPropertyOptional({ type: [CreateUnitFleetMaintenanceEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateUnitFleetMaintenanceEntryDto)
  maintenanceEntries?: CreateUnitFleetMaintenanceEntryDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tireCondition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceAlertByKm?: boolean;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  maintenanceNextDateOverride?: string;

  @ApiPropertyOptional({
    description:
      'Km acumulados desde el último mantenimiento. Se reinicia al concluir servicio.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceKmCounter?: number;

  /** @deprecated Ignorado en escritura; intervalo definido a nivel empresa. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceKmInterval?: number;

  /** @deprecated Ignorado en escritura. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenanceTripKmAtLastService?: number;

  /** @deprecated Ignorado en escritura; usar maintenanceKmCounter. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maintenanceKmRemaining?: number;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  verificationPhysMechDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  verificationPhysMechCost?: number;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  verificationEmissionsDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  verificationEmissionsCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verificationDoubleArticulatedApplies?: boolean;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  verificationDoubleArticulatedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  verificationDoubleArticulatedCost?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasGps?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gpsProviderBrand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gpsPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gpsPaymentCadence?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  gpsContractDate?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  gpsLastPaymentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gpsPaymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gpsInvoiceRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gpsTrackingPortalUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gpsCoveredByInsuranceEndorsement?: boolean;

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
