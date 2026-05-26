import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth/auth.guard';
import { SepomexLookupService } from './sepomex-lookup.service';

@ApiTags('geo')
@ApiBearerAuth('access-token')
@Controller('geo')
@UseGuards(AuthGuard)
export class GeoController {
  constructor(private readonly sepomex: SepomexLookupService) {}

  @Get('mx/postal-codes/:postalCode')
  @ApiOperation({ summary: 'Asentamientos por código postal (SEPOMex, MX)' })
  lookupMxPostalCode(@Param('postalCode') postalCode: string) {
    return this.sepomex.lookupByPostalCode(postalCode);
  }
}
