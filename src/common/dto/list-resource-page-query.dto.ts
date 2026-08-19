import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const RESOURCE_LIST_DEFAULT_LIMIT = 50;

export const RESOURCE_LIST_ALLOWED_LIMITS = [10, 15, 25, 50, 100] as const;

export type ResourceListResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export function normalizeResourceListLimit(limit?: number): number {
  if (limit == null) {
    return RESOURCE_LIST_DEFAULT_LIMIT;
  }
  if ((RESOURCE_LIST_ALLOWED_LIMITS as readonly number[]).includes(limit)) {
    return limit;
  }
  return RESOURCE_LIST_DEFAULT_LIMIT;
}

export function normalizeResourceListPage(page?: number): number {
  return Math.max(1, page ?? 1);
}

/** Query page/limit compartido para listados de catálogo (operadores, clientes, flota). */
export class ListResourcePageQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Filas por página (máximo 100).',
    default: RESOURCE_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export function toResourceListResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): ResourceListResult<T> {
  return {
    items,
    total,
    page: limit > 0 ? page : 1,
    limit: limit > 0 ? limit : total,
  };
}
