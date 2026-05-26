import { ForbiddenException } from '@nestjs/common';
import AuthUser from '../../types/auth-user.type';

/** Ensures route :companyId (public numeric id) matches the authenticated user's tenant. */
export function assertCompanyAccess(
  user: AuthUser,
  companyId: string | number,
): void {
  if (String(user.companyId) !== String(companyId)) {
    throw new ForbiddenException('Access denied for this company');
  }
}
