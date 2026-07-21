import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1. Historial de verificaciones en `fleet_verification_entries`.
 * 2. Backfill de last maintenance → entries si faltaba historial.
 * 3. Slim de unit/equipment fleet profiles: sin last_*, override, km legacy ni scalars de verificación.
 */
export class FleetVerificationEntriesAndSlimProfiles1748600000000
  implements MigrationInterface
{
  name = 'FleetVerificationEntriesAndSlimProfiles1748600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.fleet_verification_entries (
        id serial PRIMARY KEY,
        unit_id int REFERENCES terminalops.units(id) ON DELETE CASCADE,
        equipment_id int REFERENCES terminalops.equipment(id) ON DELETE CASCADE,
        scope text NOT NULL,
        entry_date date,
        cost numeric(14, 2),
        notes text,
        payment_method text,
        status text NOT NULL DEFAULT 'concluido',
        sort_order smallint NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fleet_verification_entries_subject_chk CHECK (
          (unit_id IS NOT NULL AND equipment_id IS NULL)
          OR (unit_id IS NULL AND equipment_id IS NOT NULL)
        ),
        CONSTRAINT fleet_verification_entries_scope_chk CHECK (
          scope IN ('phys_mech', 'emissions', 'double_articulated')
        ),
        CONSTRAINT fleet_verification_entries_status_chk CHECK (
          status = 'concluido'
        )
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verification_entries_unit_id
        ON terminalops.fleet_verification_entries (unit_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_verification_entries_equipment_id
        ON terminalops.fleet_verification_entries (equipment_id);
    `);

    // Backfill unit verifications (one entry per scope that has a date)
    await queryRunner.query(`
      INSERT INTO terminalops.fleet_verification_entries (
        unit_id, scope, entry_date, cost, status, sort_order
      )
      SELECT p.unit_id, 'phys_mech', p.verification_phys_mech_date,
             p.verification_phys_mech_cost, 'concluido', 0
      FROM terminalops.unit_fleet_profiles p
      WHERE p.verification_phys_mech_date IS NOT NULL;
    `);
    await queryRunner.query(`
      INSERT INTO terminalops.fleet_verification_entries (
        unit_id, scope, entry_date, cost, status, sort_order
      )
      SELECT p.unit_id, 'emissions', p.verification_emissions_date,
             p.verification_emissions_cost, 'concluido', 0
      FROM terminalops.unit_fleet_profiles p
      WHERE p.verification_emissions_date IS NOT NULL;
    `);
    await queryRunner.query(`
      INSERT INTO terminalops.fleet_verification_entries (
        unit_id, scope, entry_date, cost, status, sort_order
      )
      SELECT p.unit_id, 'double_articulated', p.verification_double_articulated_date,
             p.verification_double_articulated_cost, 'concluido', 0
      FROM terminalops.unit_fleet_profiles p
      WHERE p.verification_double_articulated_date IS NOT NULL;
    `);

    // Backfill equipment phys-mech
    await queryRunner.query(`
      INSERT INTO terminalops.fleet_verification_entries (
        equipment_id, scope, entry_date, cost, status, sort_order
      )
      SELECT p.equipment_id, 'phys_mech', p.verification_phys_mech_date,
             p.verification_phys_mech_cost, 'concluido', 0
      FROM terminalops.equipment_fleet_profiles p
      WHERE p.verification_phys_mech_date IS NOT NULL;
    `);

    // Ensure last maintenance scalars become history when no entries exist
    await queryRunner.query(`
      INSERT INTO terminalops.fleet_maintenance_entries (
        unit_id, entry_date, entry_type, cost, notes, status, sort_order
      )
      SELECT
        p.unit_id,
        p.last_maintenance_date,
        COALESCE(NULLIF(TRIM(p.last_maintenance_type), ''), 'Servicio'),
        p.last_maintenance_cost,
        p.last_maintenance_notes,
        'concluido',
        0
      FROM terminalops.unit_fleet_profiles p
      WHERE p.last_maintenance_date IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM terminalops.fleet_maintenance_entries e
          WHERE e.unit_id = p.unit_id
        );
    `);
    await queryRunner.query(`
      INSERT INTO terminalops.fleet_maintenance_entries (
        equipment_id, entry_date, entry_type, cost, notes, status, sort_order
      )
      SELECT
        p.equipment_id,
        p.last_maintenance_date,
        COALESCE(NULLIF(TRIM(p.last_maintenance_type), ''), 'Servicio'),
        p.last_maintenance_cost,
        p.last_maintenance_notes,
        'concluido',
        0
      FROM terminalops.equipment_fleet_profiles p
      WHERE p.last_maintenance_date IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM terminalops.fleet_maintenance_entries e
          WHERE e.equipment_id = p.equipment_id
        );
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS last_maintenance_date,
        DROP COLUMN IF EXISTS last_maintenance_type,
        DROP COLUMN IF EXISTS last_maintenance_cost,
        DROP COLUMN IF EXISTS last_maintenance_notes,
        DROP COLUMN IF EXISTS maintenance_alert_by_km,
        DROP COLUMN IF EXISTS maintenance_next_date_override,
        DROP COLUMN IF EXISTS maintenance_km_interval,
        DROP COLUMN IF EXISTS maintenance_trip_km_at_last_service,
        DROP COLUMN IF EXISTS maintenance_km_remaining,
        DROP COLUMN IF EXISTS verification_phys_mech_date,
        DROP COLUMN IF EXISTS verification_phys_mech_cost,
        DROP COLUMN IF EXISTS verification_emissions_date,
        DROP COLUMN IF EXISTS verification_emissions_cost,
        DROP COLUMN IF EXISTS verification_double_articulated_date,
        DROP COLUMN IF EXISTS verification_double_articulated_cost;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        DROP COLUMN IF EXISTS last_maintenance_date,
        DROP COLUMN IF EXISTS last_maintenance_type,
        DROP COLUMN IF EXISTS last_maintenance_cost,
        DROP COLUMN IF EXISTS last_maintenance_notes,
        DROP COLUMN IF EXISTS maintenance_alert_by_km,
        DROP COLUMN IF EXISTS maintenance_next_date_override,
        DROP COLUMN IF EXISTS maintenance_km_interval,
        DROP COLUMN IF EXISTS maintenance_trip_km_at_last_service,
        DROP COLUMN IF EXISTS maintenance_km_remaining,
        DROP COLUMN IF EXISTS verification_phys_mech_date,
        DROP COLUMN IF EXISTS verification_phys_mech_cost;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS last_maintenance_date date,
        ADD COLUMN IF NOT EXISTS last_maintenance_type text,
        ADD COLUMN IF NOT EXISTS last_maintenance_cost numeric(14, 2),
        ADD COLUMN IF NOT EXISTS last_maintenance_notes text,
        ADD COLUMN IF NOT EXISTS maintenance_alert_by_km boolean,
        ADD COLUMN IF NOT EXISTS maintenance_next_date_override date,
        ADD COLUMN IF NOT EXISTS maintenance_km_interval numeric(10, 2),
        ADD COLUMN IF NOT EXISTS maintenance_trip_km_at_last_service numeric(12, 2),
        ADD COLUMN IF NOT EXISTS maintenance_km_remaining numeric(12, 2),
        ADD COLUMN IF NOT EXISTS verification_phys_mech_date date,
        ADD COLUMN IF NOT EXISTS verification_phys_mech_cost numeric(14, 2),
        ADD COLUMN IF NOT EXISTS verification_emissions_date date,
        ADD COLUMN IF NOT EXISTS verification_emissions_cost numeric(14, 2),
        ADD COLUMN IF NOT EXISTS verification_double_articulated_date date,
        ADD COLUMN IF NOT EXISTS verification_double_articulated_cost numeric(14, 2);
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        ADD COLUMN IF NOT EXISTS last_maintenance_date date,
        ADD COLUMN IF NOT EXISTS last_maintenance_type text,
        ADD COLUMN IF NOT EXISTS last_maintenance_cost numeric(14, 2),
        ADD COLUMN IF NOT EXISTS last_maintenance_notes text,
        ADD COLUMN IF NOT EXISTS maintenance_alert_by_km boolean,
        ADD COLUMN IF NOT EXISTS maintenance_next_date_override date,
        ADD COLUMN IF NOT EXISTS maintenance_km_interval numeric(10, 2),
        ADD COLUMN IF NOT EXISTS maintenance_trip_km_at_last_service numeric(12, 2),
        ADD COLUMN IF NOT EXISTS maintenance_km_remaining numeric(12, 2),
        ADD COLUMN IF NOT EXISTS verification_phys_mech_date date,
        ADD COLUMN IF NOT EXISTS verification_phys_mech_cost numeric(14, 2);
    `);

    // Restore latest scalars from verification entries
    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles p
      SET
        verification_phys_mech_date = s.entry_date,
        verification_phys_mech_cost = s.cost
      FROM (
        SELECT DISTINCT ON (unit_id) unit_id, entry_date, cost
        FROM terminalops.fleet_verification_entries
        WHERE unit_id IS NOT NULL AND scope = 'phys_mech'
        ORDER BY unit_id, entry_date DESC NULLS LAST, id DESC
      ) s
      WHERE p.unit_id = s.unit_id;
    `);
    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles p
      SET
        verification_emissions_date = s.entry_date,
        verification_emissions_cost = s.cost
      FROM (
        SELECT DISTINCT ON (unit_id) unit_id, entry_date, cost
        FROM terminalops.fleet_verification_entries
        WHERE unit_id IS NOT NULL AND scope = 'emissions'
        ORDER BY unit_id, entry_date DESC NULLS LAST, id DESC
      ) s
      WHERE p.unit_id = s.unit_id;
    `);
    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles p
      SET
        verification_double_articulated_date = s.entry_date,
        verification_double_articulated_cost = s.cost
      FROM (
        SELECT DISTINCT ON (unit_id) unit_id, entry_date, cost
        FROM terminalops.fleet_verification_entries
        WHERE unit_id IS NOT NULL AND scope = 'double_articulated'
        ORDER BY unit_id, entry_date DESC NULLS LAST, id DESC
      ) s
      WHERE p.unit_id = s.unit_id;
    `);
    await queryRunner.query(`
      UPDATE terminalops.equipment_fleet_profiles p
      SET
        verification_phys_mech_date = s.entry_date,
        verification_phys_mech_cost = s.cost
      FROM (
        SELECT DISTINCT ON (equipment_id) equipment_id, entry_date, cost
        FROM terminalops.fleet_verification_entries
        WHERE equipment_id IS NOT NULL AND scope = 'phys_mech'
        ORDER BY equipment_id, entry_date DESC NULLS LAST, id DESC
      ) s
      WHERE p.equipment_id = s.equipment_id;
    `);

    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles p
      SET
        last_maintenance_date = s.entry_date,
        last_maintenance_type = s.entry_type,
        last_maintenance_cost = s.cost,
        last_maintenance_notes = s.notes
      FROM (
        SELECT DISTINCT ON (unit_id) unit_id, entry_date, entry_type, cost, notes
        FROM terminalops.fleet_maintenance_entries
        WHERE unit_id IS NOT NULL
        ORDER BY unit_id, entry_date DESC NULLS LAST, id DESC
      ) s
      WHERE p.unit_id = s.unit_id;
    `);
    await queryRunner.query(`
      UPDATE terminalops.equipment_fleet_profiles p
      SET
        last_maintenance_date = s.entry_date,
        last_maintenance_type = s.entry_type,
        last_maintenance_cost = s.cost,
        last_maintenance_notes = s.notes
      FROM (
        SELECT DISTINCT ON (equipment_id) equipment_id, entry_date, entry_type, cost, notes
        FROM terminalops.fleet_maintenance_entries
        WHERE equipment_id IS NOT NULL
        ORDER BY equipment_id, entry_date DESC NULLS LAST, id DESC
      ) s
      WHERE p.equipment_id = s.equipment_id;
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_verification_entries;
    `);
  }
}
