import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { DestinationRatePriceInputDto } from './destination-rate-price-input.dto';

export class CreateDestinationRateDto {
  @ApiProperty({ example: '77560' })
  @IsString()
  @Length(5, 5)
  postalCode: string;

  @ApiProperty({ example: 'Cancún, Quintana Roo' })
  @IsString()
  cityMunicipality: string;

  @ApiProperty({ example: 'Alfredo V. Bonfil' })
  @IsString()
  locality: string;

  @ApiProperty({ type: [DestinationRatePriceInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DestinationRatePriceInputDto)
  prices: DestinationRatePriceInputDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
