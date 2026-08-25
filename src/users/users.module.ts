import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from 'src/users/entities/app-user.entity';
import { UserPreferences } from 'src/users/entities/user-preferences.entity';
import { UserModuleAccess } from 'src/users/entities/user-module-access.entity';
import { RefreshTokensModule } from '../auth/refresh-tokens.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/** Global: AuthGuard (y otros) necesitan UsersService en el módulo del controller. */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AppUser, UserPreferences, UserModuleAccess]),
    RefreshTokensModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}