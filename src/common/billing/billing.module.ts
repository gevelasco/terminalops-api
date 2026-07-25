import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { AppUser } from 'src/users/entities/app-user.entity';
import { PlanEnforcementService } from './plan-enforcement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Unit,
      Equipment,
      Operator,
      Trip,
      AppUser,
    ]),
  ],
  providers: [PlanEnforcementService],
  exports: [PlanEnforcementService],
})
export class BillingModule {}
