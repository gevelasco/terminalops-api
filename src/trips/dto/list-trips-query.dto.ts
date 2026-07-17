import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
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
    description: 'Filas por página (máximo 100).',
    default: 15,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Búsqueda en código, ruta, cliente, operador, unidad y configuración',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por estatus de maniobra. Acepta varios separados por coma (p. ej. "scheduled,in_transit").',
    example: 'scheduled,in_transit',
  })
  @IsOptional()
  @IsString()
  @Matches(
    new RegExp(
      `^(${TRIP_LIST_STATUSES.join('|')})(,(${TRIP_LIST_STATUSES.join('|')}))*$`,
    ),
    { message: 'status must be a comma-separated list of valid trip statuses' },
  )
  status?: string;
}

export function parseTripListStatusFilter(
  status?: string,
): TripListStatusFilter[] {
  if (!status?.trim()) {
    return [];
  }
  const allowed = new Set<string>(TRIP_LIST_STATUSES);
  return [
    ...new Set(
      status
        .split(',')
        .map((s) => s.trim())
        .filter((s) => allowed.has(s)),
    ),
  ] as TripListStatusFilter[];
}
