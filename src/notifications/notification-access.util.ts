import {
  APP_MODULE_CODES,
  type AppModuleCode,
} from 'src/common/constants/app-modules';
import { canReadModule } from 'src/common/utils/module-permission.util';
import type AuthUser from 'src/types/auth-user.type';

/** entityType del feed → módulo RBAC (lectura). */
export function moduleForNotificationEntity(
  entityType: string | null | undefined,
): AppModuleCode | null {
  switch (entityType?.trim()) {
    case 'trip':
      return APP_MODULE_CODES.TRIPS;
    case 'unit':
    case 'equipment':
      return APP_MODULE_CODES.FLEET;
    case 'operator':
      return APP_MODULE_CODES.OPERATORS;
    case 'client':
      return APP_MODULE_CODES.CLIENTS;
    case 'expense':
    case 'expenses':
      return APP_MODULE_CODES.EXPENSES;
    default:
      return null;
  }
}

/**
 * Admin/owner: sin filtro (null).
 * Staff: entityTypes permitidos por grants de lectura (puede ser []).
 */
export function allowedNotificationEntityTypes(
  user: AuthUser,
): string[] | null {
  const role = user.role?.trim().toLowerCase() ?? '';
  if (role === 'superadmin' || role === 'admin') {
    return null;
  }

  const types: string[] = [];
  if (canReadModule(user.role, user.moduleGrants, APP_MODULE_CODES.TRIPS)) {
    types.push('trip');
  }
  if (canReadModule(user.role, user.moduleGrants, APP_MODULE_CODES.FLEET)) {
    types.push('unit', 'equipment');
  }
  if (canReadModule(user.role, user.moduleGrants, APP_MODULE_CODES.OPERATORS)) {
    types.push('operator');
  }
  if (canReadModule(user.role, user.moduleGrants, APP_MODULE_CODES.CLIENTS)) {
    types.push('client');
  }
  if (canReadModule(user.role, user.moduleGrants, APP_MODULE_CODES.EXPENSES)) {
    types.push('expense', 'expenses');
  }
  return types;
}

export function canSeeNotificationItem(
  user: AuthUser,
  item: { entityType?: string | null },
): boolean {
  const module = moduleForNotificationEntity(item.entityType);
  if (!module) {
    const role = user.role?.trim().toLowerCase() ?? '';
    return role === 'superadmin' || role === 'admin';
  }
  return canReadModule(user.role, user.moduleGrants, module);
}
