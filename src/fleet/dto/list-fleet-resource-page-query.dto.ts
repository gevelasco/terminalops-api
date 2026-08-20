import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ListResourcePageQueryDto } from '../../common/dto/list-resource-page-query.dto';

/** Listado de flota: page/limit más filtros de asignación y tenure. */
export class ListFleetResourcePageQueryDto extends ListResourcePageQueryDto {
  @ApiPropertyOptional({
    description:
      'Si true, solo recursos activos en status available (asignables a una maniobra).',
    example: 'true',
  })
  @IsOptional()
  @IsString()
  available?: string;

  @ApiPropertyOptional({
    description: 'Si true, incluye datos de tenure de flotilla.',
  })
  @IsOptional()
  @IsString()
  includeFleetTenure?: string;
}
