import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { CompanyOperationConfiguration } from 'src/operation-configurations/entities/company-operation-configuration.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { TripsModule } from 'src/trips/trips.module';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { FleetBrand } from 'src/fleet/entities/fleet-brand.entity';
import { FleetBrandVersion } from 'src/fleet/entities/fleet-brand-version.entity';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
import { FleetOverviewService } from 'src/fleet/fleet-overview.service';
import { FleetBrandsService } from 'src/fleet/fleet-brands.service';

@Module({
  imports: [
    TripsModule,
    TypeOrmModule.forFeature([
      FleetAssetTenure,
      FleetBrand,
      FleetBrandVersion,
      Unit,
      Equipment,
      Trip,
      CompanyOperationConfiguration,
    ]),
  ],
  providers: [FleetTenureService, FleetOverviewService, FleetBrandsService],
  exports: [
    FleetTenureService,
    FleetOverviewService,
    FleetBrandsService,
    TripsModule,
  ],
})
export class FleetModule {}
