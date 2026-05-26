import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateEquipmentDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  serialNumber: string;

  @ApiPropertyOptional({ description: 'ID público numérico de la unidad' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
