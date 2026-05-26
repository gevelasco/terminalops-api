import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { Company } from 'src/companies/entities/company.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { ResourcePublicIdService } from './resource-public-id.service';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Company,
      Operator,
      Client,
      Unit,
      Equipment,
      Trip,
      Expense,
    ]),
  ],
  providers: [TenantContextService, ResourcePublicIdService],
  exports: [TenantContextService, ResourcePublicIdService],
})
export class TenantModule {}
