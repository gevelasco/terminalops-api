import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { fleetOperationalCodeSql } from 'src/common/utils/fleet-operational-code-sql.util';

const schema = TERMINALOPS_SCHEMA;

/** Espacios → guiones (mismo criterio que la placa en el código operativo). */
export function normalizeTripListSearchNeedle(q: string): string {
  return q.trim().replace(/\s+/g, '-');
}

const CODE_TOKEN_RE =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+(?:-[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)+$/;
const FLEET_CODE_RE =
  /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,8}-\d{4}(?:-[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+)*$/;

/**
 * Código con guiones: unidad, placa o maniobra.
 * No trata nombres (`Juan Perez`) como código aunque se normalicen a guiones.
 */
export function isTripListCodeSearch(q: string): boolean {
  const trimmed = q.trim();
  if (CODE_TOKEN_RE.test(trimmed)) {
    return true;
  }
  return FLEET_CODE_RE.test(normalizeTripListSearchNeedle(trimmed));
}

export function tripListFleetMatchSql(alias: string): string {
  return `(
    ${fleetOperationalCodeSql(alias)} ILIKE :qPrefix
    OR ${alias}.plate ILIKE :q
    OR ${alias}.plate ILIKE :qContains
    OR REPLACE(${alias}.plate, ' ', '-') ILIKE :qContains
    OR COALESCE(${alias}.name, '') ILIKE :q
    OR COALESCE(${alias}.trailer_brand_abbr, '') ILIKE :qPrefix
    OR COALESCE(${alias}.serial_number, '') ILIKE :q
    OR COALESCE(${alias}.serial_number, '') ILIKE :qContains
  )`;
}

export function tripListUnitIdInSql(): string {
  return `SELECT u.id FROM ${schema}.units u
    WHERE u.company_id = :companyId
      AND ${tripListFleetMatchSql('u')}`;
}

export function tripListEquipmentTripIdInSql(): string {
  return `SELECT te.trip_id FROM ${schema}.trip_equipment te
    INNER JOIN ${schema}.equipment eq ON eq.id = te.equipment_id
    WHERE eq.company_id = :companyId
      AND (
        ${fleetOperationalCodeSql('eq')} ILIKE :qPrefix
        OR eq.plate ILIKE :qContains
        OR REPLACE(eq.plate, ' ', '-') ILIKE :qContains
        OR COALESCE(eq.trailer_brand_abbr, '') ILIKE :qPrefix
      )`;
}

export function tripListOperatorIdInSql(): string {
  return `SELECT op.id FROM ${schema}.operators op
    WHERE op.company_id = :companyId
      AND op.name ILIKE :q`;
}

export function tripListCodeSearchSql(): string {
  return `(
    trip.maneuver_code ILIKE :qPrefix
    OR trip.unit_id IN (${tripListUnitIdInSql()})
    OR trip.id IN (${tripListEquipmentTripIdInSql()})
  )`;
}

export function tripListContainsSearchSql(): string {
  return `(
    trip.maneuver_code ILIKE :q
    OR COALESCE(trip.origin_locality, '') ILIKE :q
    OR COALESCE(trip.origin_city_municipality, '') ILIKE :q
    OR COALESCE(trip.origin_postal_code, '') ILIKE :q
    OR COALESCE(trip.destination_locality, '') ILIKE :q
    OR COALESCE(trip.destination_city_municipality, '') ILIKE :q
    OR COALESCE(trip.destination_postal_code, '') ILIKE :q
    OR trip.client_name ILIKE :q
    OR trip.status ILIKE :q
    OR trip.operation_type ILIKE :q
    OR (trip.has_incident = true AND 'incidente' ILIKE :q)
    OR (trip.status = 'scheduled' AND 'programado' ILIKE :q)
    OR (trip.status = 'in_transit' AND (
      'en curso' ILIKE :q OR 'transito' ILIKE :q OR 'tránsito' ILIKE :q OR 'ruta' ILIKE :q
    ))
    OR (trip.status = 'completed' AND (
      'completado' ILIKE :q OR 'terminado' ILIKE :q
    ))
    OR (trip.status = 'cancelled' AND 'cancelado' ILIKE :q)
    OR trip.operator_id IN (${tripListOperatorIdInSql()})
    OR trip.unit_id IN (${tripListUnitIdInSql()})
    OR trip.id IN (${tripListEquipmentTripIdInSql()})
  )`;
}

export function tripListSearchParams(
  q: string,
  companyId: number,
): Record<string, string | number> {
  const needle = normalizeTripListSearchNeedle(q);
  return {
    q: `%${q.trim()}%`,
    qPrefix: `${needle}%`,
    qContains: `%${needle}%`,
    companyId,
  };
}
