import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class RouteWaypointInputDto {
  @ApiProperty({ example: 19.7 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: -101.18 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @ApiProperty({ example: 'Morelia, Michoacán' })
  @IsString()
  @MaxLength(200)
  label: string;

  @ApiPropertyOptional({ example: 'Morelia, Morelia' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchLabel?: string;
}