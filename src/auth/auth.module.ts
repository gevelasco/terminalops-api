import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import EnvConfig from '../types/env-config.type';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    UsersModule,
    CompaniesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      global: true,
      useFactory: (config: ConfigService<EnvConfig>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        global: true,
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
