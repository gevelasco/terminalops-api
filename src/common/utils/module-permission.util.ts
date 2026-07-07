import { ForbiddenException } from '@nestjs/common';
import {
  APP_MODULE_CODES,
  type AppModuleCode,
  type ModuleAccessLevel,
  type StaffGrantableModuleCode,
  type StaffModuleGrant,
  STAFF_GRANTABLE_MODULE_CODES,
  STAFF_RBAC_MODULE_CODES,
  normalizeStaffModuleGrants,
  resolveAllowedModules,
  resolveStaffModuleGrants,
  moduleCodesFromStaffGrants,
} from 'src/common/constants/app-modules';
import type AuthUser from 'src/types/auth-user.type';

export {
  type ModuleAccessLevel,
  type StaffModuleGrant,
  STAFF_RBAC_MODULE_CODES,
  resolveStaffModuleGrants,
  resolveAllowedModules,
};

export function isRbacModule(
  module: StaffGrantableModuleCode,
): module is (typeof STAFF_RBAC_MODULE_CODES)[number] {
  return (STAFF_RBAC_MODULE_CODES as readonly string[]).includes(module);
}

export function grantsFromLegacyModuleCodes(
  moduleCodes: readonly string[] | undefined,
): StaffModuleGrant[] {
  return normalizeStaffModuleGrants(moduleCodes).map((module) => ({
    module,
    level: 'write' as const,
  }));
}

export function mergeModuleGrantInput(input: {
  moduleGrants?: readonly StaffModuleGrant[] | undefined;
  moduleCodes?: readonly string[] | undefined;
}): StaffModuleGrant[] {
  if (input.moduleGrants?.length) {
    return resolveStaffModuleGrants(input.moduleGrants);
  }
  return grantsFromLegacyModuleCodes(input.moduleCodes);
}

export function moduleCodesFromGrants(
  grants: readonly StaffModuleGrant[] | undefined,
): StaffGrantableModuleCode[] {
  return moduleCodesFromStaffGrants(grants);
}

function grantLevelForModule(
  grants: readonly StaffModuleGrant[] | undefined,
  module: AppModuleCode,
): ModuleAccessLevel | null {
  const row = (grants ?? []).find((grant) => grant.module === module);
  return row?.level ?? null;
}

export function canReadModule(
  role: string,
  grants: readonly StaffModuleGrant[] | undefined,
  module: AppModuleCode,
): boolean {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === 'superadmin' || normalizedRole === 'admin') {
    return resolveAllowedModules(role, moduleCodesFromGrants(grants)).includes(module);
  }
  if (module === APP_MODULE_CODES.DASHBOARD) {
    return true;
  }
  const level = grantLevelForModule(grants, module);
  if (level === 'read' || level === 'write') {
    return true;
  }
  return false;
}

export function canWriteModule(
  role: string,
  grants: readonly StaffModuleGrant[] | undefined,
  module: AppModuleCode,
): boolean {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === 'superadmin' || normalizedRole === 'admin') {
    return resolveAllowedModules(role, moduleCodesFromGrants(grants)).includes(module);
  }
  if (module === APP_MODULE_CODES.DASHBOARD) {
    return false;
  }
  const level = grantLevelForModule(grants, module);
  if (level === 'write') {
    return true;
  }
  return false;
}

export function canPostTripBitacora(user: AuthUser): boolean {
  return canReadModule(user.role, user.moduleGrants, APP_MODULE_CODES.TRIPS);
}

export function canMarkTripIncident(user: AuthUser): boolean {
  return canWriteModule(user.role, user.moduleGrants, APP_MODULE_CODES.TRIPS);
}

export function assertModuleRead(user: AuthUser, module: AppModuleCode): void {
  if (!canReadModule(user.role, user.moduleGrants, module)) {
    throw forbiddenForModule(module, 'read');
  }
}

export function assertModuleWrite(user: AuthUser, module: AppModuleCode): void {
  if (!canWriteModule(user.role, user.moduleGrants, module)) {
    throw forbiddenForModule(module, 'write');
  }
}

export function assertTripBitacoraAccess(
  user: AuthUser,
  isIncident: boolean,
): void {
  if (isIncident) {
    if (!canMarkTripIncident(user)) {
      throw new ForbiddenException(
        'No tienes permiso de escritura en Maniobras para marcar incidentes.',
      );
    }
    return;
  }
  if (!canPostTripBitacora(user)) {
    throw new ForbiddenException(
      'No tienes permiso de lectura en Maniobras para usar la bitácora.',
    );
  }
}

function forbiddenForModule(
  module: AppModuleCode,
  kind: 'read' | 'write',
): ForbiddenException {
  const label = moduleLabel(module);
  const action = kind === 'read' ? 'consultar' : 'modificar';
  return new ForbiddenException(
    `No tienes permiso para ${action} el módulo ${label}.`,
  );
}

function moduleLabel(module: AppModuleCode): string {
  switch (module) {
    case APP_MODULE_CODES.TRIPS:
      return 'Maniobras';
    case APP_MODULE_CODES.FLEET:
      return 'Flota';
    case APP_MODULE_CODES.OPERATORS:
      return 'Operadores';
    case APP_MODULE_CODES.CLIENTS:
      return 'Comercial';
    case APP_MODULE_CODES.EXPENSES:
      return 'Gastos';
    case APP_MODULE_CODES.REPORTS:
      return 'Reportes';
    default:
      return module;
  }
}

export function normalizeStaffModuleGrantsFromRows(
  rows: readonly { moduleCode: string; accessLevel?: string | null }[],
): StaffModuleGrant[] {
  const allowed = new Set<string>(STAFF_GRANTABLE_MODULE_CODES);
  const merged = new Map<StaffGrantableModuleCode, ModuleAccessLevel>();
  for (const row of rows) {
    const code = row.moduleCode?.trim();
    if (!code || !allowed.has(code)) {
      continue;
    }
    const module = code as StaffGrantableModuleCode;
    const level: ModuleAccessLevel =
      row.accessLevel?.trim().toLowerCase() === 'read' ? 'read' : 'write';
    const prev = merged.get(module);
    if (!prev || (prev === 'read' && level === 'write')) {
      merged.set(module, level);
    }
  }
  return [...merged.entries()].map(([module, level]) => ({ module, level }));
}
