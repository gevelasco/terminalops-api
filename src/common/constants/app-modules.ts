export const APP_MODULE_CODES = {
  DASHBOARD: 'dashboard',
  TRIPS: 'trips',
  FLEET: 'fleet',
  OPERATORS: 'operators',
  CLIENTS: 'clients',
  EXPENSES: 'expenses',
  REPORTS: 'reports',
  ACCOUNT: 'account',
  USERS: 'users',
} as const;

export type AppModuleCode =
  (typeof APP_MODULE_CODES)[keyof typeof APP_MODULE_CODES];

export const STAFF_GRANTABLE_MODULE_CODES = [
  APP_MODULE_CODES.TRIPS,
  APP_MODULE_CODES.FLEET,
  APP_MODULE_CODES.OPERATORS,
  APP_MODULE_CODES.CLIENTS,
  APP_MODULE_CODES.EXPENSES,
  APP_MODULE_CODES.REPORTS,
] as const satisfies readonly AppModuleCode[];

export type StaffGrantableModuleCode =
  (typeof STAFF_GRANTABLE_MODULE_CODES)[number];

/** Módulos con permisos Lectura / Escritura por separado. */
export const STAFF_RBAC_MODULE_CODES = [
  APP_MODULE_CODES.TRIPS,
  APP_MODULE_CODES.FLEET,
  APP_MODULE_CODES.OPERATORS,
  APP_MODULE_CODES.CLIENTS,
  APP_MODULE_CODES.EXPENSES,
  APP_MODULE_CODES.REPORTS,
] as const satisfies readonly StaffGrantableModuleCode[];

export type StaffRbacModuleCode = (typeof STAFF_RBAC_MODULE_CODES)[number];

export type ModuleAccessLevel = 'read' | 'write';

export interface StaffModuleGrant {
  module: StaffGrantableModuleCode;
  level: ModuleAccessLevel;
}

const OPERATIONAL_MODULE_CODES: AppModuleCode[] = [
  APP_MODULE_CODES.DASHBOARD,
  ...STAFF_GRANTABLE_MODULE_CODES,
];

const ADMIN_MODULE_CODES: AppModuleCode[] = [
  ...OPERATIONAL_MODULE_CODES,
  APP_MODULE_CODES.USERS,
];

const OWNER_MODULE_CODES: AppModuleCode[] = [
  ...ADMIN_MODULE_CODES,
  APP_MODULE_CODES.ACCOUNT,
];

export function normalizeStaffModuleGrants(
  grants: readonly string[] | undefined,
): StaffGrantableModuleCode[] {
  if (!grants?.length) {
    return [];
  }
  const allowed = new Set<string>(STAFF_GRANTABLE_MODULE_CODES);
  return [...new Set(grants.filter((code) => allowed.has(code)))] as StaffGrantableModuleCode[];
}

export function resolveStaffModuleGrants(
  grants: readonly StaffModuleGrant[] | undefined,
): StaffModuleGrant[] {
  if (!grants?.length) {
    return [];
  }
  const allowed = new Set<string>(STAFF_GRANTABLE_MODULE_CODES);
  const merged = new Map<StaffGrantableModuleCode, ModuleAccessLevel>();
  for (const grant of grants) {
    const module = grant.module?.trim();
    if (!module || !allowed.has(module)) {
      continue;
    }
    const code = module as StaffGrantableModuleCode;
    const level: ModuleAccessLevel =
      grant.level?.trim().toLowerCase() === 'read' ? 'read' : 'write';
    const prev = merged.get(code);
    if (!prev || (prev === 'read' && level === 'write')) {
      merged.set(code, level);
    }
  }
  return [...merged.entries()].map(([module, level]) => ({ module, level }));
}

export function moduleCodesFromStaffGrants(
  grants: readonly StaffModuleGrant[] | undefined,
): StaffGrantableModuleCode[] {
  return resolveStaffModuleGrants(grants).map((grant) => grant.module);
}

export function resolveAllowedModules(
  role: string,
  grants: readonly string[] | StaffModuleGrant[] | undefined,
): AppModuleCode[] {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === 'superadmin') {
    return [...OWNER_MODULE_CODES];
  }
  if (normalizedRole === 'admin') {
    return [...ADMIN_MODULE_CODES];
  }
  const moduleCodes = Array.isArray(grants) && grants.length > 0 && typeof grants[0] === 'object'
    ? moduleCodesFromStaffGrants(grants as StaffModuleGrant[])
    : normalizeStaffModuleGrants(grants as string[] | undefined);
  return [APP_MODULE_CODES.DASHBOARD, ...moduleCodes];
}

export function isOwnerRole(role: string): boolean {
  return role.trim().toLowerCase() === 'superadmin';
}

export function isAdminRole(role: string): boolean {
  const normalized = role.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'superadmin';
}

export function canManageUsers(role: string): boolean {
  return isAdminRole(role);
}

export function canViewAccount(role: string): boolean {
  return isOwnerRole(role);
}
