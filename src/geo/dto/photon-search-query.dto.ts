import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PhotonSearchQueryDto {
  @ApiProperty()
  @IsString()
  q!: string;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(30)
  limit?: number;

  @ApiPropertyOptional({ default: 'default' })
  @IsOptional()
  @IsString()
  lang?: string;

  @ApiPropertyOptional({ description: 'minLon,minLat,maxLon,maxLat' })
  @IsOptional()
  @IsString()
  bbox?: string;
}

export class PhotonReverseQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  lon!: number;

  @ApiPropertyOptional({ default: 'default' })
  @IsOptional()
  @IsString()
  lang?: string;
}