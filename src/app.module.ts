import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { CompaniesModule } from './companies/companies.module';
import { EquipmentModule } from './equipment/equipment.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DestinationRatesModule } from './destination-rates/destination-rates.module';
import { OperationConfigurationsModule } from './operation-configurations/operation-configurations.module';
import { GeoModule } from './geo/geo.module';
import { OperatorsModule } from './operators/operators.module';
import { TripsModule } from './trips/trips.module';
import { UnitsModule } from './units/units.module';
import { TenantModule } from './common/tenant/tenant.module';
import EnvConfig from './types/env-config.type';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TenantModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvConfig>) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', { infer: true }),
        port: configService.get('DB_PORT', { infer: true }),
        username: configService.get('DB_USERNAME', { infer: true }),
        password: configService.get('DB_PASSWORD', { infer: true }),
        database: configService.get('DB_DATABASE', { infer: true }),
        entities: [__dirname + '/**/*.entity.{ts,js}'],
        ssl: false,
        synchronize: false,
      }),
    }),
    AuthModule,
    CompaniesModule,
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
  providers: [AppService],
})
export class AppModule {}
