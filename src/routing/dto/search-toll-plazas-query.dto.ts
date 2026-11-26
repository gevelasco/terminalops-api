import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class SearchTollPlazasQueryDto {
  @ApiProperty({ example: 'cuyut', description: 'Texto a buscar en nombre o sección' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q: string;

  @ApiPropertyOptional({ description: 'Ejes del tracto (default 5)', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(12)
  axleCount?: number;

  @ApiPropertyOptional({ description: 'Máximo de resultados (default 20)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  limit?: number;
}
