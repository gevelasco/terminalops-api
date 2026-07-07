import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from 'src/users/entities/app-user.entity';
import { Client } from 'src/clients/entities/client.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { TripAuditEvent } from 'src/trips/entities/trip-audit-event.entity';
import { TripAuditService } from './lifecycle/trip-audit.service';
import { TripLifecycleScheduler } from './lifecycle/trip-lifecycle.scheduler';
import { TripFleetStatusSyncService } from './lifecycle/trip-fleet-status-sync.service';
import { TripLifecycleService } from './lifecycle/trip-lifecycle.service';
import { UnitTripOdometerModule } from 'src/units/unit-trip-odometer.module';
import { FuelPriceModule } from 'src/fuel/fuel-price.module';
import { DestinationRatesModule } from 'src/destination-rates/destination-rates.module';
import { OperationalCentersModule } from 'src/operational-centers/operational-centers.module';
import { OperationConfigurationsModule } from 'src/operation-configurations/operation-configurations.module';
import { ExpensesModule } from 'src/expenses/expenses.module';
import { Company } from 'src/companies/entities/company.entity';
import { TripsController } from './trips.controller';
import { FuelEstimatorService } from './fuel/fuel-estimator.service';
import { TripsService } from './trips.service';

@Module({
  imports: [
    FuelPriceModule,
    OperationConfigurationsModule,
    DestinationRatesModule,
    OperationalCentersModule,
    TypeOrmModule.forFeature([
      Trip,
      TripEquipment,
      TripIncident,
      TripAuditEvent,
      Equipment,
      Client,
      Company,
      Unit,
      Operator,
      AppUser,
    ]),
    ExpensesModule,
    UnitTripOdometerModule,
  ],
  controllers: [TripsController],
  providers: [
    TripsService,
    FuelEstimatorService,
    TripLifecycleService,
    TripFleetStatusSyncService,
    TripAuditService,
    TripLifecycleScheduler,
  ],
  exports: [
    TripsService,
    FuelEstimatorService,
    TripLifecycleService,
    TripFleetStatusSyncService,
  ],
})
export class TripsModule {}
