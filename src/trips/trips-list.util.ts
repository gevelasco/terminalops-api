import type { SelectQueryBuilder } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import type { Trip } from './entities/trip.entity';
import {
  parseTripListStatusFilter,
  type ListTripsQueryDto,
} from './dto/list-trips-query.dto';
import { tripNotDeletedSql } from './trip-visibility.util';

export const TRIP_LIST_DEFAULT_LIMIT = 15;

export const TRIP_LIST_ALLOWED_LIMITS = [10, 15, 25, 50, 100] as const;

export function normalizeTripListLimit(limit?: number): number {
  if (limit == null) {
    return TRIP_LIST_DEFAULT_LIMIT;
  }
  if ((TRIP_LIST_ALLOWED_LIMITS as readonly number[]).includes(limit)) {
    return limit;
  }
  return TRIP_LIST_DEFAULT_LIMIT;
}

export function applyTripListFilters(
  qb: SelectQueryBuilder<Trip>,
  companyId: number,
  query?: ListTripsQueryDto,
): SelectQueryBuilder<Trip> {
  qb.where('trip.companyId = :companyId', { companyId });
  qb.andWhere(tripNotDeletedSql('trip'));

  const statuses = parseTripListStatusFilter(query?.status);
  if (statuses.length > 0) {
    qb.andWhere('trip.status IN (:...statuses)', { statuses });
  }

  const q = query?.q?.trim();
  if (!q) {
    return qb;
  }

  const schema = TERMINALOPS_SCHEMA;
  qb.andWhere(
    `(
      trip.maneuver_code ILIKE :q
      OR CAST(trip.id AS TEXT) ILIKE :q
      OR trip.origin ILIKE :q
      OR trip.destination ILIKE :q
      OR trip.client_name ILIKE :q
      OR CAST(COALESCE(trip.client_id, 0) AS TEXT) ILIKE :q
      OR trip.status ILIKE :q
      OR trip.operation_type ILIKE :q
      OR COALESCE(trip.operation_configuration_name_snapshot, '') ILIKE :q
      OR COALESCE(trip.operator_name_snapshot, '') ILIKE :q
      OR COALESCE(trip.unit_operational_code_snapshot, '') ILIKE :q
      OR CAST(COALESCE(trip.departure_at, trip.planned_departure_at) AS TEXT) ILIKE :q
      OR CAST(COALESCE(trip.arrived_at, trip.planned_arrival_at) AS TEXT) ILIKE :q
      OR (trip.has_incident = true AND 'incidente' ILIKE :q)
      OR (trip.status = 'scheduled' AND 'programado' ILIKE :q)
      OR (trip.status = 'in_transit' AND (
        'en curso' ILIKE :q OR 'transito' ILIKE :q OR 'tránsito' ILIKE :q OR 'ruta' ILIKE :q
      ))
      OR (trip.status = 'completed' AND (
        'completado' ILIKE :q OR 'terminado' ILIKE :q
      ))
      OR (trip.status = 'cancelled' AND 'cancelado' ILIKE :q)
      OR EXISTS (
        SELECT 1 FROM ${schema}.operators op
        WHERE op.id = trip.operator_id
          AND op.company_id = :companyId
          AND op.name ILIKE :q
      )
      OR EXISTS (
        SELECT 1 FROM ${schema}.units u
        WHERE u.id = trip.unit_id
          AND u.company_id = :companyId
          AND (
            u.plate ILIKE :q
            OR COALESCE(u.name, '') ILIKE :q
            OR COALESCE(u.trailer_brand_abbr, '') ILIKE :q
            OR COALESCE(u.serial_number, '') ILIKE :q
          )
      )
      OR EXISTS (
        SELECT 1 FROM ${schema}.trip_equipment te
        INNER JOIN ${schema}.equipment eq ON eq.id = te.equipment_id
        WHERE te.trip_id = trip.id
          AND eq.company_id = :companyId
          AND (
            eq.plate ILIKE :q
            OR COALESCE(eq.trailer_brand_abbr, '') ILIKE :q
          )
      )
    )`,
    { q: `%${q}%`, companyId },
  );

  return qb;
}
