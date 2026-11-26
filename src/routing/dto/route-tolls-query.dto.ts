import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RouteWaypointDto } from './route-waypoint.dto';

export class RouteTollsQueryDto {
  @ApiProperty({ example: 19.05 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  originLat: number;

  @ApiProperty({ example: -104.65 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  originLon: number;

  @ApiProperty({ example: 25.67 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  destinationLat: number;

  @ApiProperty({ example: -100.31 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  destinationLon: number;

  @ApiPropertyOptional({
    description: 'Ejes del tracto (2–8). Default 5.',
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(12)
  axleCount?: number;

  @ApiPropertyOptional({
    description: 'Etiqueta opcional del origen (compat; OSRM usa coordenadas).',
    example: 'Manzanillo, Manzanillo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  originSearch?: string;

  @ApiPropertyOptional({
    description: 'Etiqueta opcional del destino (compat; OSRM usa coordenadas).',
    example: 'Monterrey, Monterrey',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  destinationSearch?: string;

  @ApiPropertyOptional({
    description:
      'Casetas omitidas en la ruta (por libre); claves `plaza:{id}`.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  excludePlazaKeys?: string[];

  @ApiPropertyOptional({
    description:
      'Puntos intermedios en orden (origen → … → destino). Vacío = OSRM directo.',
    type: [RouteWaypointDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => RouteWaypointDto)
  waypoints?: RouteWaypointDto[];
}