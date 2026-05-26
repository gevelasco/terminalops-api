import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string;
}
