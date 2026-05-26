import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type AuthUser from '../types/auth-user.type';

export const LoggedUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
