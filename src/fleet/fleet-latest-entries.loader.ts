import type { EntityManager } from 'typeorm';
import type { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import type { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';

/**
 * Carga solo la última entrada de mantenimiento/verificación por asset.
 * Evita join de historial completo en listados.
 */
export async function loadLatestMaintenanceByOwnerIds(
  manager: EntityManager,
  schema: string,
  ownerColumn: 'unit_id' | 'equipment_id',
  ownerIds: readonly number[],
): Promise<Map<number, FleetMaintenanceEntry[]>> {
  const out = new Map<number, FleetMaintenanceEntry[]>();
  if (ownerIds.length === 0) {
    return out;
  }
  const rows: Array<{
    id: number;
    unit_id: number | null;
    equipment_id: number | null;
    entry_date: string | null;
    entry_type: string | null;
    cost: string | null;
    notes: string | null;
    payment_method: string | null;
    sort_order: number;
  }> = await manager.query(
    `
    SELECT DISTINCT ON (${ownerColumn})
      id, unit_id, equipment_id, entry_date, entry_type, cost, notes,
      payment_method, sort_order
    FROM ${schema}.fleet_maintenance_entries
    WHERE ${ownerColumn} = ANY($1::int[])
    ORDER BY ${ownerColumn}, sort_order DESC NULLS LAST, entry_date DESC NULLS LAST, id DESC
    `,
    [ownerIds],
  );
  for (const row of rows) {
    const ownerId =
      ownerColumn === 'unit_id' ? row.unit_id : row.equipment_id;
    if (ownerId == null) {
      continue;
    }
    out.set(ownerId, [
      {
        id: row.id,
        unitId: row.unit_id ?? undefined,
        equipmentId: row.equipment_id ?? undefined,
        entryDate: row.entry_date ?? undefined,
        entryType: row.entry_type ?? undefined,
        cost: row.cost ?? undefined,
        notes: row.notes ?? undefined,
        paymentMethod: row.payment_method ?? undefined,
        sortOrder: row.sort_order ?? 0,
      } as FleetMaintenanceEntry,
    ]);
  }
  return out;
}

export async function loadLatestVerificationByOwnerIds(
  manager: EntityManager,
  schema: string,
  ownerColumn: 'unit_id' | 'equipment_id',
  ownerIds: readonly number[],
): Promise<Map<number, FleetVerificationEntry[]>> {
  const out = new Map<number, FleetVerificationEntry[]>();
  if (ownerIds.length === 0) {
    return out;
  }
  const rows: Array<{
    id: number;
    unit_id: number | null;
    equipment_id: number | null;
    scope: FleetVerificationEntry['scope'];
    entry_date: string | null;
    cost: string | null;
    notes: string | null;
    payment_method: string | null;
    sort_order: number;
  }> = await manager.query(
    `
    SELECT DISTINCT ON (${ownerColumn}, scope)
      id, unit_id, equipment_id, scope, entry_date, cost, notes,
      payment_method, sort_order
    FROM ${schema}.fleet_verification_entries
    WHERE ${ownerColumn} = ANY($1::int[])
    ORDER BY ${ownerColumn}, scope, sort_order DESC NULLS LAST,
      entry_date DESC NULLS LAST, id DESC
    `,
    [ownerIds],
  );
  for (const row of rows) {
    const ownerId =
      ownerColumn === 'unit_id' ? row.unit_id : row.equipment_id;
    if (ownerId == null) {
      continue;
    }
    const bucket = out.get(ownerId) ?? [];
    bucket.push({
      id: row.id,
      unitId: row.unit_id ?? undefined,
      equipmentId: row.equipment_id ?? undefined,
      scope: row.scope,
      entryDate: row.entry_date ?? undefined,
      cost: row.cost ?? undefined,
      notes: row.notes ?? undefined,
      paymentMethod: row.payment_method ?? undefined,
      sortOrder: row.sort_order ?? 0,
    } as FleetVerificationEntry);
    out.set(ownerId, bucket);
  }
  return out;
}
