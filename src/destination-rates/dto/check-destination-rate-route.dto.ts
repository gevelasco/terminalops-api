import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

export class CheckDestinationRateRouteQueryDto {
  @ApiProperty({ description: 'ID público del centro operativo de origen' })
  @IsString()
  originOperationalCenterId: string;

  @ApiPropertyOptional({ example: '44100' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== '')
  @IsString()
  @Length(5, 5)
  @Matches(/^\d{5}$/)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Guadalajara' })
  @IsOptional()
  @IsString()
  locality?: string;

  @ApiPropertyOptional({ example: 'Zapopan' })
  @IsOptional()
  @IsString()
  municipalityName?: string;

  @ApiPropertyOptional({ example: 'Jalisco' })
  @IsOptional()
  @IsString()
  stateName?: string;

  @ApiPropertyOptional({
    description: 'Línea "municipio, estado" (alternativa a municipalityName/stateName)',
  })
  @IsOptional()
  @IsString()
  cityMunicipality?: string;
}
