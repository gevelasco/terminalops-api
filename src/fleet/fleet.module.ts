import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';

@Module({
  imports: [TypeOrmModule.forFeature([FleetAssetTenure])],
  providers: [FleetTenureService],
  exports: [FleetTenureService],
})
export class FleetModule {}
