/** Código operativo SQL: MARCA-AÑO-PLACA (mismo criterio que buildUnitOperationalId). */
export function fleetOperationalCodeSql(alias: string): string {
  return `CASE
  WHEN NULLIF(UPPER(TRIM(${alias}.trailer_brand_abbr)), '') IS NOT NULL
    AND NULLIF(TRIM(${alias}.trailer_year), '') IS NOT NULL
    AND NULLIF(REGEXP_REPLACE(TRIM(${alias}.plate), '\\\\s+', '-', 'g'), '') IS NOT NULL
  THEN TRIM(
    CONCAT_WS(
      '-',
      UPPER(TRIM(${alias}.trailer_brand_abbr)),
      TRIM(${alias}.trailer_year),
      REGEXP_REPLACE(TRIM(${alias}.plate), '\\\\s+', '-', 'g')
    )
  )
  ELSE ${alias}.id::text
END`;
}
