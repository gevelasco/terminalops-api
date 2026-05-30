import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}
