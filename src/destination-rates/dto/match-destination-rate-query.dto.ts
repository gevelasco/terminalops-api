import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CheckDestinationRateRouteQueryDto } from './check-destination-rate-route.dto';

export class MatchDestinationRateQueryDto extends CheckDestinationRateRouteQueryDto {
  @ApiPropertyOptional({
    description: 'Tarifa vinculada a la entrega del cliente (id público)',
  })
  @IsOptional()
  @IsString()
  clientDestinationRateId?: string;
}
