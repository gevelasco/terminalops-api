import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cleanup de columnas históricas en trips: labels/snapshots/delays/tolls
 * se calculan en vivo o se dejan de persistir. Conserva partes postales,
 * casetas_amount, diesel liters/amount, unit_odometer_km_credited, etc.
 */
export class CleanupTripsColumns1748200000000 implements MigrationInterface {
  name = 'CleanupTripsColumns1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_delay_phase_check;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS origin,
        DROP COLUMN IF EXISTS destination,
        DROP COLUMN IF EXISTS operator_license_number,
        DROP COLUMN IF EXISTS operator_license_expires_label,
        DROP COLUMN IF EXISTS is_round_trip,
        DROP COLUMN IF EXISTS operation_configuration_name_snapshot,
        DROP COLUMN IF EXISTS operation_configuration_version_snapshot,
        DROP COLUMN IF EXISTS operation_configuration_max_equipment_count_snapshot,
        DROP COLUMN IF EXISTS operator_name_snapshot,
        DROP COLUMN IF EXISTS unit_operational_code_snapshot,
        DROP COLUMN IF EXISTS diesel_price_per_liter_at_creation,
        DROP COLUMN IF EXISTS toll_calculation_mode,
        DROP COLUMN IF EXISTS toll_route_id,
        DROP COLUMN IF EXISTS route_toll_amount,
        DROP COLUMN IF EXISTS is_delayed,
        DROP COLUMN IF EXISTS delay_phase,
        DROP COLUMN IF EXISTS delay_departure_minutes,
        DROP COLUMN IF EXISTS delay_arrival_minutes,
        DROP COLUMN IF EXISTS delay_completion_minutes,
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS open_incident_count;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS destination text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS operator_license_number text,
        ADD COLUMN IF NOT EXISTS operator_license_expires_label text,
        ADD COLUMN IF NOT EXISTS is_round_trip boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS operation_configuration_name_snapshot text NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS operation_configuration_version_snapshot integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS operation_configuration_max_equipment_count_snapshot smallint NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS operator_name_snapshot text,
        ADD COLUMN IF NOT EXISTS unit_operational_code_snapshot text,
        ADD COLUMN IF NOT EXISTS diesel_price_per_liter_at_creation numeric(10, 4),
        ADD COLUMN IF NOT EXISTS toll_calculation_mode varchar(16),
        ADD COLUMN IF NOT EXISTS toll_route_id integer,
        ADD COLUMN IF NOT EXISTS route_toll_amount numeric(14, 2),
        ADD COLUMN IF NOT EXISTS is_delayed boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS delay_phase text,
        ADD COLUMN IF NOT EXISTS delay_departure_minutes integer,
        ADD COLUMN IF NOT EXISTS delay_arrival_minutes integer,
        ADD COLUMN IF NOT EXISTS delay_completion_minutes integer,
        ADD COLUMN IF NOT EXISTS operational_distance_km numeric(10, 2),
        ADD COLUMN IF NOT EXISTS open_incident_count integer NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_delay_phase_check;
      ALTER TABLE terminalops.trips
        ADD CONSTRAINT trips_delay_phase_check
        CHECK (
          delay_phase IS NULL
          OR delay_phase IN ('none', 'departure', 'arrival', 'completion')
        );
    `);
  }
}
