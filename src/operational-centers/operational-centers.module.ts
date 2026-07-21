import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';
import { OperationalCenter } from './entities/operational-center.entity';
import { OperationalCentersService } from './operational-centers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OperationalCenter, Company, DestinationRate]),
  ],
  providers: [OperationalCentersService],
  exports: [OperationalCentersService],
})
export class OperationalCentersModule {}
