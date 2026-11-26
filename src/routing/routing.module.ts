import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TollPlaza } from 'src/tolls/entities/toll-plaza.entity';
import { TollPlazaCatalogService } from 'src/tolls/toll-plaza-catalog.service';
import { OsrmClient } from './osrm.client';
import { OsrmTollRouteService } from './osrm-toll-route.service';
import { RoutingController } from './routing.controller';
import { TollPlazaAlias } from './entities/toll-plaza-alias.entity';
import { TollPlazaGlobalAlias } from './entities/toll-plaza-global-alias.entity';
import { TollPlazaAliasService } from './toll-plaza-alias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TollPlaza,
      TollPlazaAlias,
      TollPlazaGlobalAlias,
    ]),
  ],
  controllers: [RoutingController],
  providers: [
    OsrmClient,
    OsrmTollRouteService,
    TollPlazaCatalogService,
    TollPlazaAliasService,
  ],
  exports: [OsrmTollRouteService],
})
export class RoutingModule {}
