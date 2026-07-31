import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { ChecklistModule } from './checklist/checklist.module';
import { ClientsModule } from './clients/clients.module';
import { CompaniesModule } from './companies/companies.module';
import { InvitationCodesModule } from './invitation-codes/invitation-codes.module';
import { EquipmentModule } from './equipment/equipment.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DestinationRatesModule } from './destination-rates/destination-rates.module';
import { OperationConfigurationsModule } from './operation-configurations/operation-configurations.module';
import { GeoModule } from './geo/geo.module';
import { OperatorsModule } from './operators/operators.module';
import { TripsModule } from './trips/trips.module';
import { UnitsModule } from './units/units.module';
import { FileModule } from './common/file/file.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { TenantModule } from './common/tenant/tenant.module';
import { ActivityEventsModule } from './activity-events/activity-events.module';
import { typeOrmEntityGlobsFromDir } from './database/typeorm-entity-globs';
import { typeOrmMigrationGlobsFromDir } from './database/typeorm-migration-globs';
import EnvConfig from './types/env-config.type';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Límite global holgado; auth aplica @Throttle más estricto.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ObservabilityModule,
    TenantModule,
    FileModule,
    ActivityEventsModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvConfig>) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', { infer: true }),
        port: configService.get('DB_PORT', { infer: true }),
        username: configService.get('DB_USERNAME', { infer: true }),
        password: configService.get('DB_PASSWORD', { infer: true }),
        database: configService.get('DB_DATABASE', { infer: true }),
        entities: typeOrmEntityGlobsFromDir(__dirname),
        migrations: typeOrmMigrationGlobsFromDir(__dirname),
        migrationsTableName: 'migrations_list',
        migrationsTransactionMode: 'each',
        // Las migraciones corren UNA sola vez en el paso previo al arranque
        // (`migration:run:server` → migrate.ts, con advisory lock).
        migrationsRun: false,
        autoLoadEntities: true,
        ssl:
          configService.get('DB_SSL', { infer: true }) === 'true'
            ? { rejectUnauthorized: false }
            : false,
        synchronize: false,
      }),
    }),
    InvitationCodesModule,
    EmailModule,
    AuthModule,
    CompaniesModule,
    ChecklistModule,
    ClientsModule,
    OperatorsModule,
    UnitsModule,
    EquipmentModule,
    TripsModule,
    ExpensesModule,
    DestinationRatesModule,
    OperationConfigurationsModule,
    GeoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
