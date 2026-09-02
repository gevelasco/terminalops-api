import { fleetOperationalCodeSql } from 'src/common/utils/fleet-operational-code-sql.util';

export { fleetOperationalCodeSql };

/** Código operativo unidad: MARCA-AÑO-PLACA (mismo criterio que buildUnitOperationalId). */
export const UNIT_OPERATIONAL_CODE_SQL = fleetOperationalCodeSql('unit');

/** Código operativo equipo: MARCA-AÑO-PLACA. */
export const EQUIPMENT_OPERATIONAL_CODE_SQL = fleetOperationalCodeSql('e');

export function normalizeMaintenanceEntryStatus(
  raw: string | null | undefined,
): string {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (normalized === 'concluido') {
    return 'Concluido';
  }
  if (normalized === 'programado') {
    return 'Programado';
  }
  if ((raw ?? '').trim()) {
    return String(raw).trim();
  }
  return 'Registrado';
}
