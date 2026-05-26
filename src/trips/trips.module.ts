import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trip,
      TripEquipment,
      TripIncident,
      Equipment,
      Client,
    ]),
  ],
  controllers: [TripsController],
  providers: [TripsService],
  exports: [TripsService],
})
export class TripsModule {}
