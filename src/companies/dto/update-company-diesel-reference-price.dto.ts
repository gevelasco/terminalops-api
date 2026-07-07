import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

export class UpdateCompanyDieselReferencePriceDto {
  @ApiProperty({
    description: 'Precio de referencia de diésel (MXN/L) para toda la empresa',
    example: 27.15,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(5)
  @Max(200)
  pricePerLiter!: number;
}
