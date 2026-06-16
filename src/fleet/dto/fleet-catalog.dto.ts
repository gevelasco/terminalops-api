import { ApiProperty } from '@nestjs/swagger';
import type { FleetBrandType } from '../entities/fleet-brand.entity';

export class FleetBrandVersionCatalogItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;
}

export class FleetBrandCatalogItemDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: ['UNIT', 'EQUIPMENT'] })
  type: FleetBrandType;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [FleetBrandVersionCatalogItemDto] })
  versions: FleetBrandVersionCatalogItemDto[];
}

export class FleetCatalogResponseDto {
  @ApiProperty({ type: [FleetBrandCatalogItemDto] })
  brands: FleetBrandCatalogItemDto[];
}
