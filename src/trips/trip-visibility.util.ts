import { IsNull, type FindOptionsWhere } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';
import type { Trip } from './entities/trip.entity';

export const TRIP_NOT_DELETED_WHERE = { deletedAt: IsNull() } as const;

export function tripNotDeletedSql(alias = 'trip'): string {
  return `${alias}.deleted_at IS NULL`;
}

export function expenseNotDiscardedSql(alias = 'e'): string {
  return `${alias}.discarded_at IS NULL`;
}

export function applyTripNotDeletedFilter<T extends Trip>(
  qb: SelectQueryBuilder<T>,
  alias = 'trip',
): SelectQueryBuilder<T> {
  return qb.andWhere(`${alias}.deleted_at IS NULL`);
}

export function mergeTripNotDeletedWhere(
  where: FindOptionsWhere<Trip>,
): FindOptionsWhere<Trip> {
  return { ...where, deletedAt: IsNull() };
}
