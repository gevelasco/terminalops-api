import { Body, Controller, Delete, Get, Put, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import {
  DeletePushSubscriptionDto,
  UpsertPushSubscriptionDto,
} from './dto/upsert-push-subscription.dto';
import { PushSubscriptionsService } from './push-subscriptions.service';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly pushSubscriptions: PushSubscriptionsService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  getMe(@LoggedUser() user: AuthUser) {
    return this.usersService.getProfileById(Number(user.id));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar perfil del usuario autenticado' })
  async patchMe(
    @LoggedUser() user: AuthUser,
    @Body() dto: UpdateUserProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(Number(user.id), dto);
    return this.usersService.toProfileResponse(updated);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Cambiar contraseña del usuario autenticado' })
  async patchPassword(
    @LoggedUser() user: AuthUser,
    @Body() dto: UpdateUserPasswordDto,
  ) {
    await this.usersService.updatePassword(
      Number(user.id),
      dto.currentPassword,
      dto.newPassword,
    );
    return { ok: true };
  }

  @Get('me/push/vapid-public-key')
  @ApiOperation({ summary: 'Clave pública VAPID para suscribir el dispositivo' })
  getPushVapidPublicKey() {
    return this.pushSubscriptions.getVapidPublicKey();
  }

  @Get('me/push/subscriptions')
  @ApiOperation({ summary: 'Suscripciones push del usuario autenticado' })
  listPushSubscriptions(@LoggedUser() user: AuthUser) {
    return this.pushSubscriptions.listForUser(Number(user.id));
  }

  @Put('me/push/subscriptions')
  @ApiOperation({
    summary: 'Registrar o actualizar la suscripción push de este dispositivo',
  })
  upsertPushSubscription(
    @LoggedUser() user: AuthUser,
    @Body() dto: UpsertPushSubscriptionDto,
  ) {
    return this.pushSubscriptions.upsertForUser(
      Number(user.id),
      Number(user.companyId),
      dto,
    );
  }

  @Delete('me/push/subscriptions')
  @ApiOperation({
    summary:
      'Eliminar la suscripción push del dispositivo indicado (no afecta otros)',
  })
  deletePushSubscription(
    @LoggedUser() user: AuthUser,
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.pushSubscriptions.deleteForUser(Number(user.id), dto);
  }
}
