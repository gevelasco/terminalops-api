import {
  APP_MODULE_CODES,
  resolveAllowedModules,
  resolveStaffModuleGrants,
  type AppModuleCode,
} from 'src/common/constants/app-modules';
import type AuthUser from 'src/types/auth-user.type';
import {
  moduleForNotificationEntity,
} from './notification-access.util';
import type { NotificationFeedItemDto } from './notifications-computed.util';

/** Módulos que pueden generar ítems en el feed (hoy). */
export const NOTIFICATION_FEED_MODULE_CODES: readonly AppModuleCode[] = [
  APP_MODULE_CODES.TRIPS,
  APP_MODULE_CODES.FLEET,
  APP_MODULE_CODES.OPERATORS,
  APP_MODULE_CODES.CLIENTS,
  APP_MODULE_CODES.DESTINATION_RATES,
  APP_MODULE_CODES.EXPENSES,
];

export function normalizeNotificationFeedModulesInput(
  raw: unknown,
): string[] | null {
  if (raw === undefined) {
    return null;
  }
  if (raw === null) {
    return null;
  }
  if (!Array.isArray(raw)) {
    return null;
  }
  const out: string[] = [];
  for (const entry of raw) {
    const code = String(entry ?? '').trim();
    if (code && !out.includes(code)) {
      out.push(code);
    }
  }
  return out;
}

export function notificationModuleForFeedKind(kind: string): AppModuleCode | null {
  const k = kind.trim();
  if (k.startsWith('trip.') || k.startsWith('receivable.')) {
    return APP_MODULE_CODES.TRIPS;
  }
  if (
    k.startsWith('unit.') ||
    k.startsWith('equipment.') ||
    k.startsWith('coverage.')
  ) {
    return APP_MODULE_CODES.FLEET;
  }
  if (k.startsWith('operator.')) {
    return APP_MODULE_CODES.OPERATORS;
  }
  if (k.startsWith('destination_rate.')) {
    return APP_MODULE_CODES.DESTINATION_RATES;
  }
  if (k.startsWith('client.')) {
    return APP_MODULE_CODES.CLIENTS;
  }
  if (
    k.startsWith('expense.') ||
    k.startsWith('payment.')
  ) {
    return APP_MODULE_CODES.EXPENSES;
  }
  return null;
}

export function notificationModuleForFeedItem(item: {
  kind: string;
  entityType?: string | null;
}): AppModuleCode | null {
  return (
    notificationModuleForFeedKind(item.kind) ??
    moduleForNotificationEntity(item.entityType)
  );
}

/**
 * `null` en BD = recibir todo lo permitido por RBAC (comportamiento legacy).
 */
function notifiableModulesForUser(allowedModules: readonly string[]): Set<string> {
  const allowed = new Set(allowedModules.map((m) => m.trim()).filter(Boolean));
  const out = new Set<string>();
  for (const code of NOTIFICATION_FEED_MODULE_CODES) {
    if (allowed.has(code)) {
      out.add(code);
    }
  }
  return out;
}

export function allowedNotificationFeedModulesForUser(
  allowedModules: readonly string[],
): string[] {
  return [...notifiableModulesForUser(allowedModules)];
}

export function resolveEffectiveNotificationFeedModules(
  stored: string[] | null | undefined,
  allowedModules: readonly string[],
): Set<string> {
  const notifiable = notifiableModulesForUser(allowedModules);
  if (stored == null) {
    return notifiable;
  }
  const enabled = new Set<string>();
  for (const code of stored) {
    const m = code.trim();
    if (m && notifiable.has(m)) {
      enabled.add(m);
    }
  }
  return enabled;
}

export function validateNotificationFeedModulesPatch(
  modules: string[],
  allowedModules: readonly string[],
): string[] {
  const allowed = notifiableModulesForUser(allowedModules);
  const out: string[] = [];
  for (const code of modules) {
    const m = code.trim();
    if (!m || !allowed.has(m)) {
      continue;
    }
    if (!out.includes(m)) {
      out.push(m);
    }
  }
  return out;
}

export function feedItemVisibleForNotificationModules(
  item: NotificationFeedItemDto,
  enabledModules: Set<string>,
): boolean {
  const module = notificationModuleForFeedItem(item);
  if (!module) {
    return true;
  }
  return enabledModules.has(module);
}

export function entityTypesForEnabledNotificationModules(
  enabledModules: Set<string>,
): string[] {
  const types: string[] = [];
  if (enabledModules.has(APP_MODULE_CODES.TRIPS)) {
    types.push('trip');
  }
  if (enabledModules.has(APP_MODULE_CODES.FLEET)) {
    types.push('unit', 'equipment');
  }
  if (enabledModules.has(APP_MODULE_CODES.OPERATORS)) {
    types.push('operator');
  }
  if (enabledModules.has(APP_MODULE_CODES.CLIENTS)) {
    types.push('client');
  }
  if (enabledModules.has(APP_MODULE_CODES.DESTINATION_RATES)) {
    types.push('destination_rate');
  }
  if (enabledModules.has(APP_MODULE_CODES.EXPENSES)) {
    types.push('expense', 'expenses');
  }
  if (types.length === 0) {
    return [];
  }
  return types;
}

export function resolveAllowedModulesForAuthUser(user: AuthUser): string[] {
  return resolveAllowedModules(
    user.role,
    resolveStaffModuleGrants(user.moduleGrants),
  );
}

export function intersectRbacAndNotificationEntityTypes(
  rbacEntityTypes: string[] | null,
  enabledModules: Set<string>,
): string[] | null {
  const feedTypes = entityTypesForEnabledNotificationModules(enabledModules);
  if (feedTypes.length === 0) {
    return [];
  }
  if (rbacEntityTypes == null) {
    return feedTypes;
  }
  return rbacEntityTypes.filter((t) => feedTypes.includes(t));
}