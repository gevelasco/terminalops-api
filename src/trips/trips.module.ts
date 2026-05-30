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
import { FuelPriceModule } from 'src/fuel/fuel-price.module';
import { OperationConfigurationsModule } from 'src/operation-configurations/operation-configurations.module';
import { TripsController } from './trips.controller';
import { FuelEstimatorService } from './fuel/fuel-estimator.service';
import { TripsService } from './trips.service';

@Module({
  imports: [
    FuelPriceModule,
    OperationConfigurationsModule,
    TypeOrmModule.forFeature([
      Trip,
      TripEquipment,
      TripIncident,
      Equipment,
      Client,
      Unit,
      Operator,
      AppUser,
    ]),
  ],
  controllers: [TripsController],
  providers: [TripsService, FuelEstimatorService],
  exports: [TripsService, FuelEstimatorService],
})
export class TripsModule {}
