import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTripDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maneuverCode?: string;

  @ApiProperty()
  @IsString()
  origin: string;

  @ApiProperty()
  @IsString()
  destination: string;

  @ApiProperty()
  @IsString()
  clientName: string;

  @ApiPropertyOptional({ description: 'ID público numérico del cliente' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'ID público numérico de la unidad' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ description: 'ID público numérico del operador' })
  @IsOptional()
  @IsString()
  operatorId?: string;

  @ApiProperty({ enum: ['scheduled', 'in_transit', 'completed', 'cancelled'] })
  @IsString()
  status: string;

  @ApiProperty()
  @IsDateString()
  programmedAt: string;

  @ApiProperty()
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: 'sencillo', description: 'Código de configuración operacional' })
  @IsString()
  operationType: string;

  @ApiProperty({ enum: ['vacio', 'lleno'] })
  @IsString()
  loadType: string;

  @ApiProperty({ enum: ['20ft', '40ft', '40hc', 'na'] })
  @IsString()
  containerType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cargoDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approximateWeightTons?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  creditDays?: number;

  @ApiPropertyOptional({ description: 'Distancia OSRM (solo ida)' })
  @IsOptional()
  @IsNumber()
  routeDistanceKm?: number;

  @ApiPropertyOptional({
    description: 'Si true (default), operationalDistanceKm = routeDistanceKm × 2',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isRoundTrip?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maneuverKind?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dieselLiters?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dieselAmount?: string;

  @ApiPropertyOptional({
    description:
      'Snapshot MXN/L al crear (fuel-estimate). Si omitido, se deriva de litros/monto o FuelPriceService.',
  })
  @IsOptional()
  @IsNumber()
  dieselPricePerLiterAtCreation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCharge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  casetasAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorQuota?: string;

  @ApiPropertyOptional({ enum: ['cash', 'transfer', 'check'] })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresInvoice?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCityMunicipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originLocality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationCityMunicipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationLocality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorLicenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorLicenseExpiresLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  departureAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivedAt?: string;

  @ApiPropertyOptional({
    enum: ['auto', 'manual'],
    description: 'Origen del monto de casetas al crear (tarifa operativa vs manual)',
  })
  @IsOptional()
  @IsString()
  tollCalculationMode?: 'auto' | 'manual';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasClientBilling?: boolean;
}
