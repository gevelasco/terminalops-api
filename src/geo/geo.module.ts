import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { SepomexLookupService } from './sepomex-lookup.service';

@Module({
  controllers: [GeoController],
  providers: [SepomexLookupService],
})
export class GeoModule {}