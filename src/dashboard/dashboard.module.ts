import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { AppUser } from 'src/users/entities/app-user.entity';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripIncident, AppUser, Operator])],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
