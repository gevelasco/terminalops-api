import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { FleetModule } from 'src/fleet/fleet.module';
import { Trip } from 'src/trips/entities/trip.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    FleetModule,
    TypeOrmModule.forFeature([
      Trip,
      Expense,
      FleetMaintenanceEntry,
      Unit,
      Equipment,
      FleetAssetTenure,
    ]),
  ],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
