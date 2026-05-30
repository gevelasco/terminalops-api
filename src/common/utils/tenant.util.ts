import { ForbiddenException, NotFoundException } from '@nestjs/common';
import AuthUser from '../../types/auth-user.type';

/** Ensures route :companyId matches the authenticated user's tenant. */
export function assertCompanyAccess(
  user: AuthUser,
  companyId: string | number,
): void {
  if (String(user.companyId) !== String(companyId)) {
    throw new ForbiddenException('Access denied for this company');
  }
}

/** Parses an optional numeric id from API string refs (e.g. trip clientId). */
export function parseOptionalNumericId(
  value?: string | number | null,
  label = 'Resource',
): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isInteger(n) || n < 1) {
    throw new NotFoundException(`${label} ${value} not found`);
  }
  return n;
}
