import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TripContainerSlotDto } from './trip-container-slot.dto';

export class CreateTripDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  maneuverCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({ description: 'ID público numérico del cliente' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ description: 'ID público numérico de la unidad' })
  @IsString()
  unitId: string;

  @ApiPropertyOptional({ description: 'ID público numérico del operador' })
  @IsOptional()
  @IsString()
  operatorId?: string;

  /**
   * Contrato frontend (obligatorio): el cliente MUST enviar plannedDepartureAt,
   * plannedArrivalAt y plannedCompletionAt. Sin estos valores el backend rechaza
   * la creación con 400.
   */
  @ApiProperty({
    description:
      'REQUIRED — Salida planificada de patio (planned_departure_at). El frontend MUST enviar este campo.',
  })
  @IsDateString()
  plannedDepartureAt: string;

  @ApiProperty({
    description:
      'REQUIRED — Llegada planificada a destino (planned_arrival_at). El frontend MUST enviar este campo.',
  })
  @IsDateString()
  plannedArrivalAt: string;

  @ApiProperty({
    description:
      'REQUIRED — Fin planificado de maniobra (planned_completion_at). El frontend MUST enviar este campo.',
  })
  @IsDateString()
  plannedCompletionAt: string;

  @ApiProperty({ example: 'sencillo', description: 'Código de configuración operacional' })
  @IsString()
  operationType: string;

  @ApiProperty({ enum: ['vacio', 'lleno'], description: 'Condición lleno / vacío' })
  @IsString()
  loadType: string;

  @ApiPropertyOptional({
    enum: ['contenedor', 'material', 'mineral', 'liquido', 'maquinaria', 'rollos'],
    description: 'Tipo de mercancía o modalidad de carga',
  })
  @IsOptional()
  @IsString()
  cargoCategory?: string;

  @ApiProperty({ enum: ['20dc', '20hc', '40dc', '40hc', '45hc', 'na'] })
  @IsString()
  containerType: string;

  @ApiPropertyOptional({
    description: 'Número ISO del contenedor (4 letras + 7 dígitos)',
    example: 'MSCU1234567',
  })
  @IsOptional()
  @IsString()
  containerNumber?: string;

  @ApiPropertyOptional({
    type: [TripContainerSlotDto],
    description:
      'Contenedores por slot (1..n). Si se omite, se usa containerType/containerNumber como slot 1.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripContainerSlotDto)
  containers?: TripContainerSlotDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cargoDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approximateWeightTons?: string;

  @ApiPropertyOptional({ description: 'Fecha y hora de carga (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  loadDate?: string;

  @ApiPropertyOptional({ description: 'Lugar de carga (catálogo por empresa)' })
  @IsOptional()
  @IsString()
  loadPlace?: string;

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
  @IsString()
  casetasAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorQuota?: string;

  @ApiPropertyOptional({
    description:
      'Viáticos del operador (MXN). Si es 0 u omitido, no se registra gasto automático.',
  })
  @IsOptional()
  @IsString()
  perDiemAmount?: string;

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
  @IsBoolean()
  hasClientBilling?: boolean;

  @ApiPropertyOptional({ description: 'ID público de la tarifa origen→destino aplicada' })
  @IsOptional()
  @IsString()
  destinationRateId?: string;

  @ApiPropertyOptional({ description: 'ID público del centro operativo de origen' })
  @IsOptional()
  @IsString()
  originOperationalCenterId?: string;
}
