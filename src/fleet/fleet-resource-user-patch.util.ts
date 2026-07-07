/**
 * A5 — Fleet status contract
 *
 * `status` is NOT a domain input. It is a derived state persisted by internal
 * engines only (trip lifecycle sync, unit maintenance workflow).
 *
 * User-facing create/update paths MUST use the pick* helpers below so
 * `status` never reaches TypeORM `repo.update()` / `save()` from API input.
 */

import { rejectClientFleetStatusMutation } from './fleet-status-lock.util';

function pickDefinedKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  rejectClientFleetStatusMutation(source);
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (value !== undefined) {
        out[key] = value;
      }
    }
  }
  return out;
}

/** Campos mutables vía API en `units` (excluye `status`). */
export const UNIT_USER_MUTABLE_KEYS = [
  'plate',
  'capacityKg',
  'capacityTons',
  'isActive',
  'serialNumber',
  'motorNumber',
  'name',
  'trailerBrandAbbr',
  'trailerYear',
] as const;

/** Campos mutables vía API en `equipment` (excluye `status`). */
export const EQUIPMENT_USER_MUTABLE_KEYS = [
  'name',
  'serialNumber',
  'plate',
  'type',
  'isActive',
  'trailerBrandAbbr',
  'trailerYear',
  'lastServiceDate',
] as const;

/** Campos mutables vía API en `operators` (excluye `status`). */
export const OPERATOR_USER_MUTABLE_KEYS = [
  'name',
  'portalUsername',
  'isActive',
  'birthDate',
  'curp',
  'rfc',
  'licenseNumber',
  'licenseExpiresOn',
  'licenseType',
  'licenseEndorsements',
  'phone',
  'phoneSecondary',
  'address',
  'companyHireDate',
  'employmentContractType',
  'paymentSchedule',
  'paymentMethod',
  'insuranceKind',
  'photoDataUrl',
] as const;

export function pickUnitUserMutableFields(
  source: Record<string, unknown>,
): Record<string, unknown> {
  return pickDefinedKeys(source, UNIT_USER_MUTABLE_KEYS);
}

export function pickEquipmentUserMutableFields(
  source: Record<string, unknown>,
): Record<string, unknown> {
  return pickDefinedKeys(source, EQUIPMENT_USER_MUTABLE_KEYS);
}

export function pickOperatorUserMutableFields(
  source: Record<string, unknown>,
): Record<string, unknown> {
  return pickDefinedKeys(source, OPERATOR_USER_MUTABLE_KEYS);
}
