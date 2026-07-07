import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OptionalIsoDate } from 'src/common/decorators/optional-iso-date.decorator';

export class CreateOperatorEmergencyContactDto {
  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  authorizedMedicalInfo?: boolean;
}

export class CreateOperatorPublicInsuranceDto {
  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  nss?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  imssAltaDate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  infonavit?: boolean;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  infonavitCreditNumber?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  fonacot?: boolean;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  fonacotCreditNumber?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOperatorPrivateInsuranceDto {
  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  carrier?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  policyNumber?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  validFrom?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  validTo?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  premiumAmount?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  premiumPeriod?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  deductibleNotes?: string;

  @ApiPropertyOptional({ default: '' })
  @IsOptional()
  @IsString()
  planSummary?: string;
}

export class CreateOperatorDocumentDto {
  @ApiPropertyOptional({ description: 'ID público numérico del documento (si ya existe)' })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty({ enum: ['operation', 'insurance'] })
  @IsIn(['operation', 'insurance'])
  slot: string;

  @ApiPropertyOptional({ description: 'ISO date YYYY-MM-DD' })
  @OptionalIsoDate()
  addedAt?: string;
}

export class CreateOperatorDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  portalUsername?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  curp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rfc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'ISO date YYYY-MM-DD' })
  @OptionalIsoDate()
  licenseExpiresOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseEndorsements?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneSecondary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  photoDataUrl?: string;

  @ApiPropertyOptional()
  @OptionalIsoDate()
  companyHireDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employmentContractType?: string;

  @ApiPropertyOptional({
    enum: ['maneuver', 'weekly', 'biweekly', 'monthly'],
    description: 'Periodicidad de pago al operador.',
    default: 'maneuver',
  })
  @IsOptional()
  @IsIn(['maneuver', 'weekly', 'biweekly', 'monthly'])
  paymentSchedule?: string;

  @ApiPropertyOptional({
    description:
      'Método de pago al operador (mismo catálogo que gastos: transfer, cash, …).',
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional({ enum: ['none', 'public', 'private'] })
  @IsOptional()
  @IsIn(['none', 'public', 'private'])
  insuranceKind?: string;

  @ApiPropertyOptional({ type: CreateOperatorEmergencyContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOperatorEmergencyContactDto)
  emergencyContact?: CreateOperatorEmergencyContactDto;

  @ApiPropertyOptional({ type: CreateOperatorPublicInsuranceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOperatorPublicInsuranceDto)
  publicInsurance?: CreateOperatorPublicInsuranceDto;

  @ApiPropertyOptional({ type: CreateOperatorPrivateInsuranceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOperatorPrivateInsuranceDto)
  privateInsurance?: CreateOperatorPrivateInsuranceDto;

  @ApiPropertyOptional({ type: [CreateOperatorDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOperatorDocumentDto)
  documents?: CreateOperatorDocumentDto[];
}
