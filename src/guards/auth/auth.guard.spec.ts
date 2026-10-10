import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../decorators/public/public.decorator';
import { AuthGuard } from './auth.guard';
import { UsersService } from '../../users/users.service';

class ProtectedHandler {
  handler() {}
}

class PublicHandler {
  @Public()
  handler() {}
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: Partial<JwtService>;
  let usersService: Partial<UsersService>;
  let reflector: Reflector;
  let context: Partial<ExecutionContext>;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    usersService = { findAuthPrincipal: jest.fn() };
    reflector = new Reflector();
    guard = new AuthGuard(
      jwtService as JwtService,
      { get: () => 'secret' } as ConfigService,
      usersService as UsersService,
      reflector,
    );
    context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
      getHandler: () => ProtectedHandler.prototype.handler,
      getClass: () => ProtectedHandler,
    };
  });

  it('allows @Public() without a token', async () => {
    context.getHandler = () => PublicHandler.prototype.handler;
    context.getClass = () => PublicHandler;
    await expect(guard.canActivate(context as ExecutionContext)).resolves.toBe(
      true,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects protected routes without a token', async () => {
    await expect(
      guard.canActivate(context as ExecutionContext),
    ).rejects.toThrow(UnauthorizedException);
  });
});
