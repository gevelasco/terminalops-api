import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { TollPlazaCatalogService } from 'src/tolls/toll-plaza-catalog.service';
import { RouteTollsQueryDto } from './dto/route-tolls-query.dto';
import { SearchTollPlazasQueryDto } from './dto/search-toll-plazas-query.dto';
import { UpsertTollPlazaAliasDto } from './dto/upsert-toll-plaza-alias.dto';
import { OsrmTollRouteService } from './osrm-toll-route.service';
import { TollPlazaAliasService } from './toll-plaza-alias.service';

@ApiTags('routing')
@ApiBearerAuth('access-token')
@Controller('routing')
@UseGuards(AuthGuard)
export class RoutingController {
  constructor(
    private readonly tollRoutes: OsrmTollRouteService,
    private readonly tollPlazaAliases: TollPlazaAliasService,
    private readonly tollCatalog: TollPlazaCatalogService,
  ) {}

  @Get('toll-plazas/search')
  @ApiOperation({
    summary: 'Autocomplete de casetas del catálogo (nombre / sección)',
  })
  async searchTollPlazas(@Query() dto: SearchTollPlazasQueryDto) {
    const items = await this.tollCatalog.search(
      dto.q,
      dto.axleCount ?? 5,
      dto.limit ?? 20,
    );
    return { items };
  }

  @Post('toll-plazas')
  @ApiOperation({
    summary:
      'Casetas sobre ruta OSRM cruzadas con catálogo TerminalOps (por ejes)',
  })
  tollPlazas(@Body() dto: RouteTollsQueryDto, @LoggedUser() user: AuthUser) {
    const companyId = Number(user.companyId);
    return this.tollRoutes.routeTollsOnTollRoad(
      {
        originLat: dto.originLat,
        originLon: dto.originLon,
        destinationLat: dto.destinationLat,
        destinationLon: dto.destinationLon,
        axleCount: dto.axleCount,
        originSearch: dto.originSearch,
        destinationSearch: dto.destinationSearch,
        excludePlazaKeys: dto.excludePlazaKeys,
        waypoints: dto.waypoints,
      },
      Number.isFinite(companyId) ? companyId : undefined,
    );
  }

  @Put('toll-plaza-aliases')
  @ApiOperation({
    summary: 'Catálogo: nombre legible opcional para una caseta',
  })
  async upsertTollPlazaAlias(
    @Body() dto: UpsertTollPlazaAliasDto,
    @LoggedUser() user: AuthUser,
  ) {
    if (user.role !== 'superadmin') {
      throw new ForbiddenException(
        'Solo el propietario puede actualizar el catálogo de casetas.',
      );
    }
    await this.tollPlazaAliases.upsertGlobalAlias(
      dto.plazaKey,
      dto.displayName,
    );
    return { ok: true };
  }
}
