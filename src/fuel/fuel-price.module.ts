import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelPrice } from './entities/fuel-price.entity';
import { FuelPriceService } from './fuel-price.service';

@Module({
  imports: [TypeOrmModule.forFeature([FuelPrice])],
  providers: [FuelPriceService],
  exports: [FuelPriceService],
})
export class FuelPriceModule {}
