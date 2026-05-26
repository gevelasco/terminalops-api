import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripIncident])],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
