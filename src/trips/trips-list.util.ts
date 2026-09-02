import type { SelectQueryBuilder } from 'typeorm';
import type { Trip } from './entities/trip.entity';
import {
  parseTripListStatusFilter,
  type ListTripsQueryDto,
} from './dto/list-trips-query.dto';
import { tripNotDeletedSql } from './trip-visibility.util';
import {
  isTripListCodeSearch,
  tripListCodeSearchSql,
  tripListContainsSearchSql,
  tripListSearchParams,
} from './trips-list-search.util';

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

  qb.andWhere(
    isTripListCodeSearch(q)
      ? tripListCodeSearchSql()
      : tripListContainsSearchSql(),
    tripListSearchParams(q, companyId),
  );

  return qb;
}
