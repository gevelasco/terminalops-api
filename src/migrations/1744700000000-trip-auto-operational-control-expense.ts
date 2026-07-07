import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renombra gastos auto del % de control operativo:
 * rubro Administración, concepto Control operativo.
 */
export class TripAutoOperationalControlExpense1744700000000
  implements MigrationInterface
{
  name = 'TripAutoOperationalControlExpense1744700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
UPDATE terminalops.expenses e
SET
  category = 'Control operativo',
  kind = 'operational_control',
  description = CASE
    WHEN e.description ILIKE 'Mantenimiento (%' THEN
      regexp_replace(
        e.description,
        '^Mantenimiento',
        'Control operativo',
        'i'
      )
    WHEN e.description ILIKE 'Cobro administrativo (%' THEN
      regexp_replace(
        e.description,
        '^Cobro administrativo',
        'Control operativo',
        'i'
      )
    ELSE
      'Control operativo — maniobra ' || COALESCE(NULLIF(trim(t.maneuver_code), ''), '#' || t.id::text)
  END
FROM terminalops.trips t
WHERE e.trip_id = t.id
  AND e.trip_id IS NOT NULL
  AND (
    e.kind IN ('maintenance', 'trip')
    AND (
      e.category IN ('Mantenimiento', 'Cobro administrativo')
      OR e.description ILIKE 'Mantenimiento (% del cobro)%'
      OR e.description ILIKE 'Cobro administrativo (% del cobro al cliente)%'
    )
    OR (
      t.maneuver_code = 'PA-0005'
      AND e.kind IN ('maintenance', 'trip', 'operational_control')
      AND (
        e.category IN ('Mantenimiento', 'Cobro administrativo', 'Control operativo')
        OR e.description ILIKE '%del cobro%'
      )
    )
  );
`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: renombrado semántico no reversible de forma segura.
  }
}
