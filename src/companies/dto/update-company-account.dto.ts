import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCompanyAccountDto {
  @ApiPropertyOptional({ example: 'Grupo VSC' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Operaciones logísticas' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;
}
