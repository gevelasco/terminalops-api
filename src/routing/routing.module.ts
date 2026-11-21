import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingController } from './routing.controller';
import { SakbeService } from './sakbe.service';
import { TollPlazaAlias } from './entities/toll-plaza-alias.entity';
import { TollPlazaGlobalAlias } from './entities/toll-plaza-global-alias.entity';
import { TollPlazaAliasService } from './toll-plaza-alias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TollPlazaAlias, TollPlazaGlobalAlias]),
  ],
  controllers: [RoutingController],
  providers: [SakbeService, TollPlazaAliasService],
  exports: [SakbeService],
})
export class RoutingModule {}