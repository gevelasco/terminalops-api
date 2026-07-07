/** Código operativo unidad: MARCA-AÑO-PLACA (mismo criterio que buildUnitOperationalId). */
export const UNIT_OPERATIONAL_CODE_SQL = `CASE
  WHEN NULLIF(UPPER(TRIM(unit.trailer_brand_abbr)), '') IS NOT NULL
    AND NULLIF(TRIM(unit.trailer_year), '') IS NOT NULL
    AND NULLIF(REGEXP_REPLACE(TRIM(unit.plate), '\\\\s+', '-', 'g'), '') IS NOT NULL
  THEN TRIM(
    CONCAT_WS(
      '-',
      UPPER(TRIM(unit.trailer_brand_abbr)),
      TRIM(unit.trailer_year),
      REGEXP_REPLACE(TRIM(unit.plate), '\\\\s+', '-', 'g')
    )
  )
  ELSE unit.id::text
END`;

/** Código operativo equipo: MARCA-AÑO-PLACA. */
export const EQUIPMENT_OPERATIONAL_CODE_SQL = `CASE
  WHEN NULLIF(UPPER(TRIM(e.trailer_brand_abbr)), '') IS NOT NULL
    AND NULLIF(TRIM(e.trailer_year), '') IS NOT NULL
    AND NULLIF(REGEXP_REPLACE(TRIM(e.plate), '\\\\s+', '-', 'g'), '') IS NOT NULL
  THEN TRIM(
    CONCAT_WS(
      '-',
      UPPER(TRIM(e.trailer_brand_abbr)),
      TRIM(e.trailer_year),
      REGEXP_REPLACE(TRIM(e.plate), '\\\\s+', '-', 'g')
    )
  )
  ELSE e.id::text
END`;

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
