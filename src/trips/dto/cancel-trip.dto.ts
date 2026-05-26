import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CancelTripDto {
  @ApiProperty()
  @IsBoolean()
  falseManeuver: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
