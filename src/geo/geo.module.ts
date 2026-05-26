import { Module } from '@nestjs/common';
import { AuthGuard } from '../guards/auth/auth.guard';
import { GeoController } from './geo.controller';
import { SepomexLookupService } from './sepomex-lookup.service';

@Module({
  controllers: [GeoController],
  providers: [SepomexLookupService, AuthGuard],
})
export class GeoModule {}
