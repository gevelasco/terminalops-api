import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import { UnitTripOdometerService } from './unit-trip-odometer.service';

/** Motor de odómetro por maniobra — sin dependencia de TripsModule ni FleetModule. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, UnitFleetProfile, Company]),
  ],
  providers: [UnitTripOdometerService],
  exports: [UnitTripOdometerService],
})
export class UnitTripOdometerModule {}
