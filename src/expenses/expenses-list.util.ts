import type { SelectQueryBuilder } from 'typeorm';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import type { Expense } from './entities/expense.entity';
import type { ListExpensesQueryDto } from './dto/list-expenses-query.dto';
import {
  expenseRubroSearchSql,
  parseExpenseListSearchDateYmd,
  paymentMethodsMatchingExpenseSearch,
  rubroKeysMatchingExpenseSearch,
} from './expense-list-search.util';
import { expenseNotDiscardedSql } from 'src/trips/trip-visibility.util';

export const EXPENSE_LIST_DEFAULT_LIMIT = 15;

export const EXPENSE_LIST_ALLOWED_LIMITS = [10, 15, 25, 50, 100] as const;

export function normalizeExpenseListLimit(limit?: number): number {
  if (limit == null) {
    return EXPENSE_LIST_DEFAULT_LIMIT;
  }
  if ((EXPENSE_LIST_ALLOWED_LIMITS as readonly number[]).includes(limit)) {
    return limit;
  }
  return EXPENSE_LIST_DEFAULT_LIMIT;
}

export function expenseListDayStartUtc(ymd: string): Date {
  return new Date(`${ymd.trim()}T00:00:00.000Z`);
}

export function expenseListDayEndExclusiveUtc(ymd: string): Date {
  const d = expenseListDayStartUtc(ymd);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export interface ExpenseListTripFilter {
  readonly tripIds?: readonly number[];
}

export function applyExpenseListFilters(
  qb: SelectQueryBuilder<Expense>,
  companyId: number,
  query?: ListExpensesQueryDto,
  tripFilter?: ExpenseListTripFilter,
): SelectQueryBuilder<Expense> {
  qb.where('e.companyId = :companyId', { companyId });
  qb.andWhere(expenseNotDiscardedSql('e'));

  const from = query?.from?.trim();
  if (from) {
    qb.andWhere('e.incurredAt >= :from', { from: expenseListDayStartUtc(from) });
  }

  const to = query?.to?.trim();
  if (to) {
    qb.andWhere('e.incurredAt < :toExclusive', {
      toExclusive: expenseListDayEndExclusiveUtc(to),
    });
  }

  const q = query?.q?.trim();
  if (q) {
    const schema = TERMINALOPS_SCHEMA;
    const matchedRubros = rubroKeysMatchingExpenseSearch(q);
    const rubroSql = expenseRubroSearchSql(matchedRubros);
    const rubroClause = rubroSql ? ` OR (${rubroSql})` : '';
    const matchedPaymentMethods = paymentMethodsMatchingExpenseSearch(q);
    const paymentMethodClause =
      matchedPaymentMethods.length > 0
        ? ` OR e.payment_method IN (${matchedPaymentMethods.map((code) => `'${code.replace(/'/g, "''")}'`).join(', ')})`
        : '';
    const searchDateYmd = parseExpenseListSearchDateYmd(q);
    const searchDateClause = searchDateYmd
      ? ` OR (e.incurred_at AT TIME ZONE 'America/Mexico_City')::date = CAST(:searchDateYmd AS date)`
      : '';
    qb.andWhere(
      `(
        e.category ILIKE :q
        OR COALESCE(e.description, '') ILIKE :q
        OR COALESCE(e.vendor, '') ILIKE :q
        OR e.kind ILIKE :q
        OR CAST(e.amount AS TEXT) ILIKE :q
        OR COALESCE(e.payment_method, '') ILIKE :q${paymentMethodClause}
        OR TO_CHAR((e.incurred_at AT TIME ZONE 'America/Mexico_City'), 'DD/MM/YYYY') ILIKE :q
        OR TO_CHAR((e.incurred_at AT TIME ZONE 'America/Mexico_City'), 'YYYY-MM-DD') ILIKE :q${searchDateClause}
        OR EXISTS (
          SELECT 1 FROM ${schema}.trips t
          WHERE t.id = e.trip_id
            AND t.company_id = :companyId
            AND t.deleted_at IS NULL
            AND t.maneuver_code ILIKE :q
        )
        OR EXISTS (
          SELECT 1 FROM ${schema}.units u
          WHERE u.id = e.related_unit_id
            AND u.company_id = :companyId
            AND (
              u.plate ILIKE :q
              OR COALESCE(u.name, '') ILIKE :q
              OR COALESCE(u.trailer_brand_abbr, '') ILIKE :q
              OR COALESCE(u.serial_number, '') ILIKE :q
            )
        )
        OR EXISTS (
          SELECT 1 FROM ${schema}.equipment eq
          WHERE eq.id = e.related_equipment_id
            AND eq.company_id = :companyId
            AND (
              eq.plate ILIKE :q
              OR COALESCE(eq.trailer_brand_abbr, '') ILIKE :q
            )
        )
        OR EXISTS (
          SELECT 1 FROM ${schema}.operators op
          WHERE op.id = e.related_operator_id
            AND op.company_id = :companyId
            AND op.name ILIKE :q
        )${rubroClause}
      )`,
      {
        q: `%${q}%`,
        companyId,
        ...(searchDateYmd ? { searchDateYmd } : {}),
      },
    );
  }

  const kind = query?.kind?.trim();
  if (kind) {
    qb.andWhere('e.kind = :kind', { kind });
  }

  const relatedUnitId = query?.relatedUnitId?.trim();
  if (relatedUnitId) {
    qb.andWhere('CAST(e.relatedUnitId AS TEXT) = :relatedUnitId', {
      relatedUnitId,
    });
  }

  const relatedEquipmentId = query?.relatedEquipmentId?.trim();
  if (relatedEquipmentId) {
    qb.andWhere('CAST(e.relatedEquipmentId AS TEXT) = :relatedEquipmentId', {
      relatedEquipmentId,
    });
  }

  const tripIds = tripFilter?.tripIds;
  if (tripIds !== undefined) {
    if (tripIds.length === 0) {
      qb.andWhere('1 = 0');
    } else {
      qb.andWhere('e.tripId IN (:...tripIds)', { tripIds: [...tripIds] });
    }
  }

  return qb;
}
