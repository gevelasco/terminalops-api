import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class MxSettlementGeocodeQueryDto {
  @ApiProperty({ description: 'Código postal de 5 dígitos' })
  @IsString()
  @Length(5, 5)
  postalCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  settlement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;
}