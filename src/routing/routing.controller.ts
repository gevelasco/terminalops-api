import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { RouteTollsQueryDto } from './dto/route-tolls-query.dto';
import { UpsertTollPlazaAliasDto } from './dto/upsert-toll-plaza-alias.dto';
import { SakbeService } from './sakbe.service';
import { TollPlazaAliasService } from './toll-plaza-alias.service';

@ApiTags('routing')
@ApiBearerAuth('access-token')
@Controller('routing')
@UseGuards(AuthGuard)
export class RoutingController {
  constructor(
    private readonly sakbe: SakbeService,
    private readonly tollPlazaAliases: TollPlazaAliasService,
  ) {}

  @Post('toll-plazas')
  @ApiOperation({
    summary:
      'Casetas en orden sobre ruta preferentemente cuota (INEGI SAKBÉ, caché temporal)',
  })
  tollPlazas(@Body() dto: RouteTollsQueryDto, @LoggedUser() user: AuthUser) {
    const companyId = Number(user.companyId);
    return this.sakbe.routeTollsOnTollRoad(
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
    summary: 'Catálogo: nombre legible para caseta cuando INEGI devuelve N/D',
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