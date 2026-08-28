import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { TRIP_FLEET_ACTIVE_STATUSES } from 'src/fleet/fleet-status-resolver.util';

export type AssignableTripContainerType =
  | 'na'
  | '20dc'
  | '20hc'
  | '40dc'
  | '40hc'
  | '45hc';

export function fleetListSchema(schema?: string | null): string {
  return schema?.trim() || TERMINALOPS_SCHEMA;
}

export function normalizeAssignableContainerType(
  raw?: string,
): AssignableTripContainerType {
  switch ((raw ?? '').trim().toLowerCase()) {
    case '20ft':
      return '20dc';
    case '40ft':
      return '40dc';
    case '20dc':
    case '20hc':
    case '40dc':
    case '40hc':
    case '45hc':
    case 'na':
      return (raw ?? '').trim().toLowerCase() as AssignableTripContainerType;
    default:
      return 'na';
  }
}

/** Unidad motriz con carga integrada (rabón, pipa, volteo, …): no es tractocamión. */
export function sqlUnitIsSelfContained(unitAlias: string): string {
  return `(
    NULLIF(BTRIM(${unitAlias}.transport_type), '') IS NOT NULL
    AND LOWER(BTRIM(${unitAlias}.transport_type)) <> 'tractocamion'
  )`;
}

export function sqlEquipmentTypeIsPlana(equipmentAlias: string): string {
  return `(
    LOWER(BTRIM(COALESCE(${equipmentAlias}.type, ''))) = 'plataforma'
    OR LOWER(BTRIM(COALESCE(${equipmentAlias}.type, ''))) LIKE '%plana%'
    OR LOWER(BTRIM(COALESCE(${equipmentAlias}.type, ''))) LIKE '%flatbed%'
  )`;
}

export function sqlEquipmentTypeIsPortacontenedor(
  equipmentAlias: string,
): string {
  return `(
    LOWER(BTRIM(COALESCE(${equipmentAlias}.type, ''))) = 'portacontenedor'
    OR LOWER(BTRIM(COALESCE(${equipmentAlias}.type, ''))) LIKE '%portacontenedor%'
    OR LOWER(BTRIM(COALESCE(${equipmentAlias}.type, ''))) LIKE '%chasis%'
    OR LOWER(BTRIM(COALESCE(${equipmentAlias}.type, ''))) LIKE '%chassis%'
  )`;
}

export function sqlActiveHitchCount(schema: string, unitAlias: string): string {
  return `(
    SELECT COUNT(*)::int
    FROM ${schema}.equipment hitch_count_eq
    WHERE hitch_count_eq.unit_id = ${unitAlias}.id
      AND hitch_count_eq.company_id = ${unitAlias}.company_id
      AND hitch_count_eq.is_active = true
  )`;
}

export function sqlUnitHasActiveHitch(schema: string, unitAlias: string): string {
  return `EXISTS (
    SELECT 1
    FROM ${schema}.equipment hitch_ready_eq
    WHERE hitch_ready_eq.unit_id = ${unitAlias}.id
      AND hitch_ready_eq.company_id = ${unitAlias}.company_id
      AND hitch_ready_eq.is_active = true
  )`;
}

/** Apta para una maniobra nueva: carga integrada o al menos un equipo enganchado. */
export function sqlUnitIsManeuverReady(schema: string, unitAlias: string): string {
  return `(
    ${sqlUnitIsSelfContained(unitAlias)}
    OR ${sqlUnitHasActiveHitch(schema, unitAlias)}
  )`;
}

export function sqlResourceNotOnActiveTrip(
  schema: string,
  resourceAlias: string,
  tripColumn: 'unit_id' | 'operator_id',
): string {
  return `NOT EXISTS (
    SELECT 1
    FROM ${schema}.trips trip_busy
    WHERE trip_busy.company_id = :companyId
      AND trip_busy.${tripColumn} = ${resourceAlias}.id
      AND trip_busy.deleted_at IS NULL
      AND trip_busy.status IN (:...assignableTripStatuses)
  )`;
}

export function sqlEquipmentNotOnActiveTrip(
  schema: string,
  equipmentAlias: string,
): string {
  return `NOT EXISTS (
    SELECT 1
    FROM ${schema}.trip_equipment te_busy
    INNER JOIN ${schema}.trips trip_busy ON trip_busy.id = te_busy.trip_id
    WHERE te_busy.equipment_id = ${equipmentAlias}.id
      AND trip_busy.company_id = :companyId
      AND trip_busy.deleted_at IS NULL
      AND trip_busy.status IN (:...assignableTripStatuses)
  )`;
}

const ASSIGNABLE_TRIP_STATUS_PARAMS = {
  assignableTripStatuses: [...TRIP_FLEET_ACTIVE_STATUSES],
};

export function applyNotOnActiveTripFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  schema: string,
  resourceAlias: string,
  tripColumn: 'unit_id' | 'operator_id',
): SelectQueryBuilder<T> {
  return qb.andWhere(
    sqlResourceNotOnActiveTrip(schema, resourceAlias, tripColumn),
    ASSIGNABLE_TRIP_STATUS_PARAMS,
  );
}

export function applyEquipmentNotOnActiveTripFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  schema: string,
  equipmentAlias: string,
): SelectQueryBuilder<T> {
  return qb.andWhere(
    sqlEquipmentNotOnActiveTrip(schema, equipmentAlias),
    ASSIGNABLE_TRIP_STATUS_PARAMS,
  );
}

export function applyUnitManeuverReadyFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  schema: string,
  unitAlias: string,
): SelectQueryBuilder<T> {
  return qb.andWhere(sqlUnitIsManeuverReady(schema, unitAlias));
}

function sqlHitchedWhere(
  schema: string,
  unitAlias: string,
  extraAnd: string,
): string {
  return `
    SELECT 1
    FROM ${schema}.equipment hitch_eq
    WHERE hitch_eq.unit_id = ${unitAlias}.id
      AND hitch_eq.company_id = ${unitAlias}.company_id
      AND hitch_eq.is_active = true
      ${extraAnd}
  `;
}

function sqlUnitConvoyMatchesOperation(
  schema: string,
  unitAlias: string,
): string {
  const hitchCount = sqlActiveHitchCount(schema, unitAlias);
  const planaHitch = sqlHitchedWhere(
    schema,
    unitAlias,
    `AND ${sqlEquipmentTypeIsPlana('hitch_eq')}`,
  );
  return `(
    CASE
      WHEN ${hitchCount} >= 2 THEN 'full'
      WHEN ${hitchCount} = 1 AND EXISTS (${planaHitch}) THEN 'plana'
      WHEN ${hitchCount} >= 1 THEN 'sencillo'
      ELSE ''
    END
  ) = LOWER(:assignableOperationType)`;
}

function sqlHitchedIsoOrPlana(schema: string, unitAlias: string): string {
  return sqlHitchedWhere(
    schema,
    unitAlias,
    `AND (
      ${sqlEquipmentTypeIsPlana('hitch_eq')}
      OR ${sqlEquipmentTypeIsPortacontenedor('hitch_eq')}
    )`,
  );
}

/**
 * Misma regla que el picker de nueva maniobra: convoy + tipo de contenedor.
 * Chasis o plataforma aceptan cualquier contenedor ISO; sin contenedor, el
 * resto de unidades (rabón, pipa, volteo, góndola, …).
 */
export function applyUnitManeuverAssignmentFilter<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  schema: string,
  unitAlias: string,
  operationType?: string,
  containerType?: string,
): SelectQueryBuilder<T> {
  const op = operationType?.trim().toLowerCase() ?? '';
  if (!op) {
    return qb;
  }
  const container = normalizeAssignableContainerType(containerType);
  const selfContained = sqlUnitIsSelfContained(unitAlias);
  const hitchCount = sqlActiveHitchCount(schema, unitAlias);
  const convoyMatches = sqlUnitConvoyMatchesOperation(schema, unitAlias);

  if (container === 'na') {
    return qb.andWhere(
      `(
        ${selfContained}
        OR (
          NOT ${selfContained}
          AND ${hitchCount} > 0
          AND NOT EXISTS (${sqlHitchedIsoOrPlana(schema, unitAlias)})
          AND ${convoyMatches}
        )
      )`,
      { assignableOperationType: op },
    );
  }

  return qb.andWhere(
    `(
      NOT ${selfContained}
      AND ${hitchCount} > 0
      AND EXISTS (${sqlHitchedIsoOrPlana(schema, unitAlias)})
      AND ${convoyMatches}
    )`,
    { assignableOperationType: op },
  );
}
