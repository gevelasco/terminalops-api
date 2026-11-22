import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const TRIP_DETAIL_VIEWS = ['expense-relations'] as const;
export type TripDetailView = (typeof TRIP_DETAIL_VIEWS)[number];

/** Variantes ligeras de GET /trips/:id (evita drawer completo). */
export class GetTripQueryDto {
  @ApiPropertyOptional({
    enum: TRIP_DETAIL_VIEWS,
    description:
      'expense-relations: ids y etiquetas de unidad/operador/equipo para vincular gastos.',
  })
  @IsOptional()
  @IsIn([...TRIP_DETAIL_VIEWS])
  view?: TripDetailView;
}