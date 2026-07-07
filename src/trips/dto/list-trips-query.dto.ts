import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const TRIP_LIST_STATUSES = [
  'scheduled',
  'in_transit',
  'completed',
  'cancelled',
] as const;

export type TripListStatusFilter = (typeof TRIP_LIST_STATUSES)[number];

export class ListTripsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Filas por página. Omitir o 0 para devolver todo el rango.',
    default: 15,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Búsqueda en código, ruta, cliente, operador, unidad y configuración',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    enum: TRIP_LIST_STATUSES,
    description: 'Filtrar por estatus de maniobra',
  })
  @IsOptional()
  @IsIn([...TRIP_LIST_STATUSES])
  status?: TripListStatusFilter;
}
