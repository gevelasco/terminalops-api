import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { SepomexLookupService } from './sepomex-lookup.service';
import { PhotonProxyService } from './photon-proxy.service';
import { MxSettlementGeocodeService } from './mx-settlement-geocode.service';

@Module({
  controllers: [GeoController],
  providers: [SepomexLookupService, PhotonProxyService, MxSettlementGeocodeService],
})
export class GeoModule {}