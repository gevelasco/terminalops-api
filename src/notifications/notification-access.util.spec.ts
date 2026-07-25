import {
  APP_MODULE_CODES,
  type AppModuleCode,
} from 'src/common/constants/app-modules';
import { canReadModule } from 'src/common/utils/module-permission.util';
import type AuthUser from 'src/types/auth-user.type';
import {
  allowedNotificationEntityTypes,
  canSeeNotificationItem,
  moduleForNotificationEntity,
} from './notification-access.util';

describe('notification-access.util', () => {
  const staff = (
    grants: AuthUser['moduleGrants'],
  ): AuthUser =>
    ({
      id: '1',
      name: 'Staff',
      email: 's@x.com',
      username: 'staff',
      role: 'staff',
      companyId: '1',
      theme: 'light',
      moduleGrants: grants,
    }) as AuthUser;

  it('maps entity types to modules', () => {
    expect(moduleForNotificationEntity('trip')).toBe(APP_MODULE_CODES.TRIPS);
    expect(moduleForNotificationEntity('unit')).toBe(APP_MODULE_CODES.FLEET);
    expect(moduleForNotificationEntity('equipment')).toBe(
      APP_MODULE_CODES.FLEET,
    );
    expect(moduleForNotificationEntity('client')).toBe(
      APP_MODULE_CODES.CLIENTS,
    );
    expect(moduleForNotificationEntity('expense')).toBe(
      APP_MODULE_CODES.EXPENSES,
    );
    expect(moduleForNotificationEntity('unknown')).toBeNull();
  });

  it('admin has no entityType filter', () => {
    const admin = {
      ...staff([]),
      role: 'admin' as const,
    };
    expect(allowedNotificationEntityTypes(admin)).toBeNull();
  });

  it('staff only gets entityTypes for readable modules', () => {
    const user = staff([
      { module: APP_MODULE_CODES.TRIPS, level: 'read' },
      { module: APP_MODULE_CODES.CLIENTS, level: 'write' },
    ]);
    expect(allowedNotificationEntityTypes(user)?.sort()).toEqual(
      ['client', 'trip'].sort(),
    );
    expect(canSeeNotificationItem(user, { entityType: 'trip' })).toBe(true);
    expect(canSeeNotificationItem(user, { entityType: 'unit' })).toBe(false);
    expect(canReadModule(user.role, user.moduleGrants, APP_MODULE_CODES.CLIENTS)).toBe(
      true,
    );
  });

  it('write grant implies can see notifications (read)', () => {
    const user = staff([{ module: APP_MODULE_CODES.FLEET, level: 'write' }]);
    expect(canSeeNotificationItem(user, { entityType: 'equipment' })).toBe(
      true,
    );
  });
});
