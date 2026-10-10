import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reconciliación idempotente (2025-10): DDL reciente que pudo no aplicarse en PRD
 * cuando `migrations_list` estaba adelantado o por timestamp duplicado (175250).
 *
 * Seguro en DBs ya alineadas (local): IF NOT EXISTS / IF EXISTS.
 */
export class ReconcileRecentSchemaDrift1752800000000
  implements MigrationInterface
{
  name = 'ReconcileRecentSchemaDrift1752800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 175220 trips: cargo_category + container_number ---
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS cargo_category text NOT NULL DEFAULT 'material',
        ADD COLUMN IF NOT EXISTS container_number text NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_cargo_category_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD CONSTRAINT trips_cargo_category_check
        CHECK (cargo_category IN (
          'contenedor',
          'material',
          'mineral',
          'liquido',
          'maquinaria',
          'rollos'
        ));
    `);

    // --- 175240 trip_containers ---
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.trip_containers (
        id serial PRIMARY KEY,
        trip_id integer NOT NULL
          REFERENCES terminalops.trips(id) ON DELETE CASCADE,
        slot smallint NOT NULL CHECK (slot >= 1 AND slot <= 8),
        container_type text NOT NULL DEFAULT 'na',
        container_number text NULL,
        CONSTRAINT trip_containers_trip_slot_unique UNIQUE (trip_id, slot)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_containers_trip_id_idx
        ON terminalops.trip_containers (trip_id);
    `);

    // --- 175250 operators: weekly_pay_day ---
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        ADD COLUMN IF NOT EXISTS weekly_pay_day varchar NULL;
    `);

    // --- 175251 unit_fleet_profiles: rendimiento km/L ---
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS approximate_performance_km_l numeric(8,2) NULL;
    `);

    // --- 175270 drop asistencia en maniobras (company + user_preferences legacy) ---
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS trip_assist_prefill_enabled,
        DROP COLUMN IF EXISTS trip_assist_prefill_changed_at;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        DROP COLUMN IF EXISTS control_automatic_recognition,
        DROP COLUMN IF EXISTS control_automatic_recognition_changed_at;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS trip_assist_prefill_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS trip_assist_prefill_changed_at timestamptz NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        ADD COLUMN IF NOT EXISTS control_automatic_recognition boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS control_automatic_recognition_changed_at timestamptz NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS approximate_performance_km_l;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        DROP COLUMN IF EXISTS weekly_pay_day;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_containers;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_cargo_category_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS container_number,
        DROP COLUMN IF EXISTS cargo_category;
    `);
  }
}
