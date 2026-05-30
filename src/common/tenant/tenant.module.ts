import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { TenantContextService } from './tenant-context.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantModule {}
