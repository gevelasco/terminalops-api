import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const MAINTENANCE_DATE_PERIODS = [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
] as const;

export type MaintenanceDatePeriod = (typeof MAINTENANCE_DATE_PERIODS)[number];

export class UpdateCompanyOperationalSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  operationalAnalysisEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Estimación automática de diesel en maniobras' })
  @IsOptional()
  @IsBoolean()
  dieselControlEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceKmControlEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Km estándar entre servicios para toda la flota' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maintenanceKmIntervalDefault?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenanceDateControlEnabled?: boolean;

  @ApiPropertyOptional({ enum: MAINTENANCE_DATE_PERIODS })
  @IsOptional()
  @IsIn(MAINTENANCE_DATE_PERIODS)
  maintenanceDatePeriodDefault?: MaintenanceDatePeriod;

  @ApiPropertyOptional({ example: 'Patio Colima' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  operationalCenterName?: string;

  @ApiPropertyOptional({ example: '64000' })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  @Matches(/^\d{5}$/)
  operationalCenterPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  operationalCenterCityMunicipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  operationalCenterLocality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  operationalCenterSettlementConsId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  operationalCenterLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  operationalCenterLongitude?: number;
}
