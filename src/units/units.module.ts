import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from 'src/common/tenant/tenant.module';
import { FleetModule } from 'src/fleet/fleet.module';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';
import { UnitFleetDocument } from 'src/units/entities/unit-fleet-document.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { UnitTripOdometerModule } from './unit-trip-odometer.module';

@Module({
  imports: [
    TenantModule,
    FleetModule,
    UnitTripOdometerModule,
    TypeOrmModule.forFeature([
      Unit,
      UnitFleetProfile,
      FleetMaintenanceEntry,
      FleetVerificationEntry,
      UnitFleetDocument,
    ]),
  ],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService, UnitTripOdometerModule],
})
export class UnitsModule {}
