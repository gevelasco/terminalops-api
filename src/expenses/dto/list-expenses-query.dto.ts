import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListExpensesQueryDto {
  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  to?: string;

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

  @ApiPropertyOptional({ description: 'Búsqueda en rubro, concepto y descripción' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo de gasto (kind)' })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiPropertyOptional({ description: 'Filtrar por unidad relacionada (id público o numérico)' })
  @IsOptional()
  @IsString()
  relatedUnitId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por equipo relacionado (id público o numérico)' })
  @IsOptional()
  @IsString()
  relatedEquipmentId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por maniobra (id público o numérico)' })
  @IsOptional()
  @IsString()
  tripId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por varias maniobras (ids públicos separados por coma)',
  })
  @IsOptional()
  @IsString()
  tripIds?: string;
}
