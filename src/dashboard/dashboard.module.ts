import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { FuelPriceModule } from 'src/fuel/fuel-price.module';
import { TripsModule } from 'src/trips/trips.module';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Unit, Equipment, Expense, Company]),
    FuelPriceModule,
    TripsModule,
  ],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
