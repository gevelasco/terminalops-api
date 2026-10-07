import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class TripContainerSlotDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 8, example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  slot?: number;

  @ApiProperty({ enum: ['20dc', '20hc', '40dc', '40hc', '45hc', 'na'] })
  @IsString()
  containerType: string;

  @ApiPropertyOptional({ example: 'MSCU1234567' })
  @IsOptional()
  @IsString()
  containerNumber?: string;
}
