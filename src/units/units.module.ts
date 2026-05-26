import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from 'src/common/tenant/tenant.module';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { UnitFleetDocument } from 'src/units/entities/unit-fleet-document.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [
    TenantModule,
    TypeOrmModule.forFeature([
      Unit,
      UnitFleetProfile,
      FleetMaintenanceEntry,
      UnitFleetDocument,
    ]),
  ],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
