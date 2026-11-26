import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientDelivery } from '../clients/entities/client-delivery.entity';
import { Company } from 'src/companies/entities/company.entity';
import { OperationConfigurationsModule } from '../operation-configurations/operation-configurations.module';
import { OperationalCentersModule } from '../operational-centers/operational-centers.module';
import { DestinationRatePrice } from './entities/destination-rate-price.entity';
import { DestinationRate } from './entities/destination-rate.entity';
import { DestinationRatesController } from './destination-rates.controller';
import { DestinationRatesService } from './destination-rates.service';
import { DestinationRateScopeMigrationService } from './destination-rate-scope-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DestinationRate,
      DestinationRatePrice,
      ClientDelivery,
      Company,
    ]),
    OperationConfigurationsModule,
    OperationalCentersModule,
  ],
  controllers: [DestinationRatesController],
  providers: [DestinationRatesService, DestinationRateScopeMigrationService],
  exports: [DestinationRatesService, DestinationRateScopeMigrationService],
})
export class DestinationRatesModule {}
