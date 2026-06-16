import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CheckDestinationRateRouteQueryDto {
  @ApiProperty({ description: 'ID público del centro operativo de origen' })
  @IsString()
  originOperationalCenterId: string;

  @ApiProperty({ example: '44100' })
  @IsString()
  @Length(5, 5)
  @Matches(/^\d{5}$/)
  postalCode: string;

  @ApiProperty({ example: 'Guadalajara' })
  @IsString()
  locality: string;
}
