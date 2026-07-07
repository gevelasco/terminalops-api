import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListTripLinkOptionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra por código de maniobra o id (parcial, sin distinguir mayúsculas).',
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
