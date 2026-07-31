import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { isAppUserLoginAllowed } from '../../auth/auth-login.util';
import { resolveAllowedModules } from '../../common/constants/app-modules';
import { normalizeStaffModuleGrantsFromRows } from '../../common/utils/module-permission.util';
import AuthUser, { type UserRole } from '../../types/auth-user.type';
import EnvConfig from '../../types/env-config.type';
import { UsersService } from '../../users/users.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.config.get('JWT_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException();
    }

    const userId = Number(payload.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException();
    }

    const principal = await this.usersService.findAuthPrincipal(userId);
    if (!principal || !isAppUserLoginAllowed(principal.status)) {
      throw new UnauthorizedException();
    }

    const moduleGrants = normalizeStaffModuleGrantsFromRows(
      principal.moduleAccess ?? [],
    );
    const role = principal.role as UserRole;

    (request as Request & { user: AuthUser }).user = {
      ...payload,
      id: String(principal.id),
      companyId: String(principal.companyId),
      role,
      moduleGrants,
      allowedModules: resolveAllowedModules(role, moduleGrants),
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
