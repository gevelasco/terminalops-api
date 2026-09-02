import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { CompaniesModule } from '../companies/companies.module';
import { EmailModule } from '../email/email.module';
import { AuthGuard } from '../guards/auth/auth.guard';
import { OperationalCentersModule } from '../operational-centers/operational-centers.module';
import { UsersModule } from '../users/users.module';
import EnvConfig from '../types/env-config.type';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokensModule } from './refresh-tokens.module';
import { ChecklistModule } from '../checklist/checklist.module';

@Global()
@Module({
  imports: [
    UsersModule,
    CompaniesModule,
    OperationalCentersModule,
    EmailModule,
    RefreshTokensModule,
    ChecklistModule,
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
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
