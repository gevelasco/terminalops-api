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

  @ApiProperty({ enum: ['sencillo', 'full', 'plana'] })
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  routeDistanceKm?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientCharge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasClientBilling?: boolean;
}
