import { ApiProperty } from '@nestjs/swagger';

/** Respuesta mínima para decidir tab Ruta vs Lista sin joins de listado/mapa. */
export class TripsOperationalSummaryDto {
  @ApiProperty({
    description: 'Maniobras programadas o en curso (no eliminadas)',
  })
  total: number;
}
