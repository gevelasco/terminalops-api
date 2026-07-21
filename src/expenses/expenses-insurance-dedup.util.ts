import { expenseFleetTargetFromRelatedIds } from 'src/expenses/expense-payload.util';

/** Coincide fecha operativa (mediodía MX) y registros legados en medianoche UTC. */
export function fleetInsuranceIncurredAtMatchSql(
  alias = 'e',
  incurredDateParam = ':incurredDate',
): string {
  return `(
    (${alias}.incurred_at AT TIME ZONE 'America/Mexico_City')::date = CAST(${incurredDateParam} AS date)
    OR ${alias}.incurred_at = (CAST(${incurredDateParam} AS date)::timestamp AT TIME ZONE 'UTC')
  )`;
}

export type FleetInsuranceExpenseRow = {
  id: number;
  company_id: number;
  /** Legado (migración 174550); preferir related_* IDs. */
  insurance_target?: string | null;
  related_unit_id: number | null;
  related_equipment_id: number | null;
  amount: string | number;
  category: string;
  incurred_at: Date | string;
};

function insuranceTargetKey(row: FleetInsuranceExpenseRow): string {
  if (row.insurance_target) {
    return row.insurance_target;
  }
  return (
    expenseFleetTargetFromRelatedIds({
      relatedUnitId: row.related_unit_id,
      relatedEquipmentId: row.related_equipment_id,
    }) ?? ''
  );
}

/** Fecha operativa canónica para deduplicar (incluye legado UTC medianoche). */
export function normalizeInsuranceOperationalDate(incurredAt: Date | string): string {
  const date = incurredAt instanceof Date ? incurredAt : new Date(incurredAt);
  const iso = date.toISOString();
  if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(iso)) {
    return iso.slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function fleetInsuranceDedupKey(row: FleetInsuranceExpenseRow): string {
  return [
    row.company_id,
    insuranceTargetKey(row),
    row.related_unit_id ?? '',
    row.related_equipment_id ?? '',
    normalizeInsuranceOperationalDate(row.incurred_at),
    String(row.amount).replace(/,/g, ''),
    (row.category ?? '').trim().toLowerCase(),
  ].join('|');
}

function fleetInsuranceKeepRank(row: FleetInsuranceExpenseRow): number {
  const date = row.incurred_at instanceof Date ? row.incurred_at : new Date(row.incurred_at);
  return /T00:00:00\.000Z$/.test(date.toISOString()) ? 1 : 0;
}

/** Conserva el gasto con mejor fecha; descarta el resto del grupo. */
export function selectDuplicateFleetInsuranceExpenseIds(
  rows: FleetInsuranceExpenseRow[],
): number[] {
  const groups = new Map<string, FleetInsuranceExpenseRow[]>();
  for (const row of rows) {
    const key = fleetInsuranceDedupKey(row);
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const discardIds: number[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) {
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const rankDiff = fleetInsuranceKeepRank(a) - fleetInsuranceKeepRank(b);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return a.id - b.id;
    });
    for (const row of sorted.slice(1)) {
      discardIds.push(row.id);
    }
  }
  return discardIds;
}
