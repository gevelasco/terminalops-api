import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ListResourcePageQueryDto } from '../../common/dto/list-resource-page-query.dto';

/** Listado de flota: page/limit más filtros de asignación y tenure. */
export class ListFleetResourcePageQueryDto extends ListResourcePageQueryDto {
  @ApiPropertyOptional({
    description:
      'Si true, solo recursos asignables a una maniobra nueva: activos, status available, sin viaje programado/en curso. En unidades, también exige enganche o carga integrada (rabón/pipa/volteo).',
    example: 'true',
  })
  @IsOptional()
  @IsString()
  available?: string;

  @ApiPropertyOptional({
    description:
      'Con available=true en unidades: filtra por configuración de convoy (sencillo, full, plana).',
    example: 'sencillo',
  })
  @IsOptional()
  @IsString()
  operationType?: string;

  @ApiPropertyOptional({
    description:
      'Con available=true en unidades: filtra por tipo de contenedor (na, 20dc, 40hc, …).',
    example: '40hc',
  })
  @IsOptional()
  @IsString()
  containerType?: string;

  @ApiPropertyOptional({
    description: 'Si true, incluye datos de tenure de flotilla.',
  })
  @IsOptional()
  @IsString()
  includeFleetTenure?: string;
}
