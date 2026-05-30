import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyOperationConfiguration } from './entities/company-operation-configuration.entity';
import { OperationConfigurationsController } from './operation-configurations.controller';
import { OperationConfigurationsService } from './operation-configurations.service';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyOperationConfiguration])],
  controllers: [OperationConfigurationsController],
  providers: [OperationConfigurationsService],
  exports: [OperationConfigurationsService],
})
export class OperationConfigurationsModule {}
