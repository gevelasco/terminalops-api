import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Búsqueda ligera para autocompletar vínculos operativos (gastos, etc.). */
export class ListResourceLinkOptionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por etiqueta visible o id (mín. 3 caracteres).',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Resuelve una opción por id interno (p. ej. al editar un gasto).',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
