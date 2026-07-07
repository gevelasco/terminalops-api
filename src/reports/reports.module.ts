import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from 'src/expenses/entities/expense.entity';
import { FleetModule } from 'src/fleet/fleet.module';
import { Trip } from 'src/trips/entities/trip.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    FleetModule,
    TypeOrmModule.forFeature([Trip, Expense, FleetMaintenanceEntry]),
  ],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
