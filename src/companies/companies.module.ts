import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule } from '../clients/clients.module';
import { OperatorsModule } from '../operators/operators.module';
import { UnitsModule } from '../units/units.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { TripsModule } from '../trips/trips.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { DestinationRatesModule } from '../destination-rates/destination-rates.module';
import { OperationConfigurationsModule } from '../operation-configurations/operation-configurations.module';
import { OperationalCentersModule } from '../operational-centers/operational-centers.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { FleetModule } from '../fleet/fleet.module';
import { ReportsModule } from '../reports/reports.module';
import { UsersModule } from '../users/users.module';
import { FuelPriceModule } from '../fuel/fuel-price.module';
import { Company } from 'src/companies/entities/company.entity';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Company]),
    ClientsModule,
    OperatorsModule,
    UnitsModule,
    EquipmentModule,
    TripsModule,
    ExpensesModule,
    DestinationRatesModule,
    OperationConfigurationsModule,
    OperationalCentersModule,
    DashboardModule,
    ReportsModule,
    FleetModule,
    UsersModule,
    FuelPriceModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
