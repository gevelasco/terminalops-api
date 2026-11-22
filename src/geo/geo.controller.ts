import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth/auth.guard';
import { SepomexLookupService } from './sepomex-lookup.service';
import { PhotonProxyService } from './photon-proxy.service';
import {
  PhotonReverseQueryDto,
  PhotonSearchQueryDto,
} from './dto/photon-search-query.dto';
import { MxSettlementGeocodeService } from './mx-settlement-geocode.service';
import { MxSettlementGeocodeQueryDto } from './dto/mx-settlement-geocode-query.dto';

@ApiTags('geo')
@ApiBearerAuth('access-token')
@Controller('geo')
@UseGuards(AuthGuard)
export class GeoController {
  constructor(
    private readonly sepomex: SepomexLookupService,
    private readonly photon: PhotonProxyService,
    private readonly mxGeocode: MxSettlementGeocodeService,
  ) {}

  @Get('mx/postal-codes/:postalCode')
  @ApiOperation({ summary: 'Asentamientos por código postal (SEPOMex, MX)' })
  lookupMxPostalCode(@Param('postalCode') postalCode: string) {
    return this.sepomex.lookupByPostalCode(postalCode);
  }

  @Get('photon/search')
  @ApiOperation({
    summary: 'Proxy de búsqueda Photon (evita CORS / bloqueos en el navegador)',
  })
  photonSearch(@Query() query: PhotonSearchQueryDto) {
    return this.photon.search({
      q: query.q,
      limit: query.limit,
      lang: query.lang,
      bbox: query.bbox,
    });
  }

  @Get('photon/reverse')
  @ApiOperation({
    summary: 'Proxy inverso Photon (municipio/estado por coordenada)',
  })
  photonReverse(@Query() query: PhotonReverseQueryDto) {
    return this.photon.reverse({
      lat: query.lat,
      lon: query.lon,
      lang: query.lang,
    });
  }

  @Get('mx/settlement-coordinates')
  @ApiOperation({
    summary:
      'Lat/lon aproximado por CP + colonia (Zippopotam / Nominatim, sin Photon)',
  })
  async mxSettlementCoordinates(@Query() query: MxSettlementGeocodeQueryDto) {
    const hit = await this.mxGeocode.resolve({
      postalCode: query.postalCode,
      settlement: query.settlement,
      municipality: query.municipality,
      state: query.state,
    });
    return hit ?? { lat: null, lon: null };
  }
}
