import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slim bitácora de maniobra: solo description + posted_by + is_incident + created_at.
 * Se elimina el modelo ticket (open/close/severity/category/occurred_at).
 */
export class CleanupTripIncidentsColumns1748300000000
  implements MigrationInterface
{
  name = 'CleanupTripIncidentsColumns1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trip_incidents_occurred_at_idx;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        DROP CONSTRAINT IF EXISTS trip_incidents_severity_check;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        DROP COLUMN IF EXISTS occurred_at,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS category,
        DROP COLUMN IF EXISTS opened_at,
        DROP COLUMN IF EXISTS closed_at,
        DROP COLUMN IF EXISTS closed_by_user_id,
        DROP COLUMN IF EXISTS resolution_notes,
        DROP COLUMN IF EXISTS severity;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        ADD COLUMN IF NOT EXISTS occurred_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'closed',
        ADD COLUMN IF NOT EXISTS category text,
        ADD COLUMN IF NOT EXISTS opened_at timestamptz,
        ADD COLUMN IF NOT EXISTS closed_at timestamptz,
        ADD COLUMN IF NOT EXISTS closed_by_user_id integer,
        ADD COLUMN IF NOT EXISTS resolution_notes text,
        ADD COLUMN IF NOT EXISTS severity text;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        DROP CONSTRAINT IF EXISTS trip_incidents_severity_check;
      ALTER TABLE terminalops.trip_incidents
        ADD CONSTRAINT trip_incidents_severity_check
        CHECK (
          severity IS NULL
          OR severity IN ('critical', 'high', 'medium', 'low')
        );
    `);
  }
}
