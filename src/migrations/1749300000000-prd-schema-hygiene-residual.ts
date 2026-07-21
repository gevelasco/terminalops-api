import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PRD hygiene residual:
 * - drop trip_attached_documents + fleet_maintenance_entry_documents (muertas)
 * - units: capacity_kg canónico; drop capacity_tons
 * - sync primary center pointer ↔ is_default
 * - drop status en maintenance/verification entries (solo concluido)
 * - drop equipment.last_service_date (derivable del historial)
 */
export class PrdSchemaHygieneResidual1749300000000
  implements MigrationInterface
{
  name = 'PrdSchemaHygieneResidual1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_attached_documents;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_maintenance_entry_documents;
    `);

    // Preferir toneladas UI cuando existan; alinear kg
    await queryRunner.query(`
      UPDATE terminalops.units
      SET capacity_kg = GREATEST(ROUND(capacity_tons::numeric * 1000), 0)::int
      WHERE capacity_tons IS NOT NULL
        AND capacity_tons::numeric > 0;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.units
        DROP COLUMN IF EXISTS capacity_tons;
    `);

    // Centro primario: pointer canónico; is_default espejo
    await queryRunner.query(`
      UPDATE terminalops.companies c
      SET primary_operational_center_id = oc.id
      FROM terminalops.operational_centers oc
      WHERE c.primary_operational_center_id IS NULL
        AND oc.company_id = c.id
        AND oc.is_default = true;
    `);
    await queryRunner.query(`
      UPDATE terminalops.companies c
      SET primary_operational_center_id = oc.id
      FROM (
        SELECT DISTINCT ON (company_id) id, company_id
        FROM terminalops.operational_centers
        ORDER BY company_id, id ASC
      ) oc
      WHERE c.primary_operational_center_id IS NULL
        AND oc.company_id = c.id;
    `);
    await queryRunner.query(`
      UPDATE terminalops.operational_centers oc
      SET is_default = (c.primary_operational_center_id IS NOT NULL
        AND oc.id = c.primary_operational_center_id)
      FROM terminalops.companies c
      WHERE oc.company_id = c.id;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP CONSTRAINT IF EXISTS fleet_maintenance_entries_status_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP COLUMN IF EXISTS status;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_verification_entries
        DROP CONSTRAINT IF EXISTS fleet_verification_entries_status_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_verification_entries
        DROP COLUMN IF EXISTS status;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.equipment
        DROP COLUMN IF EXISTS last_service_date;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment
        ADD COLUMN IF NOT EXISTS last_service_date date;
    `);
    await queryRunner.query(`
      UPDATE terminalops.equipment e
      SET last_service_date = sub.max_date
      FROM (
        SELECT equipment_id, MAX(entry_date) AS max_date
        FROM terminalops.fleet_maintenance_entries
        WHERE equipment_id IS NOT NULL AND entry_date IS NOT NULL
        GROUP BY equipment_id
      ) sub
      WHERE e.id = sub.equipment_id
        AND e.last_service_date IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_verification_entries
        ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'concluido';
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_verification_entries
        ADD CONSTRAINT fleet_verification_entries_status_chk
        CHECK (status = 'concluido');
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ADD COLUMN IF NOT EXISTS status text;
    `);
    await queryRunner.query(`
      UPDATE terminalops.fleet_maintenance_entries
      SET status = 'concluido'
      WHERE status IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ADD CONSTRAINT fleet_maintenance_entries_status_check
        CHECK (status IS NULL OR status = 'concluido');
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.units
        ADD COLUMN IF NOT EXISTS capacity_tons numeric(10, 2);
    `);
    await queryRunner.query(`
      UPDATE terminalops.units
      SET capacity_tons = ROUND(capacity_kg::numeric / 1000, 2)
      WHERE capacity_kg > 0 AND capacity_tons IS NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.fleet_maintenance_entry_documents (
        id serial PRIMARY KEY,
        maintenance_entry_id integer NOT NULL
          REFERENCES terminalops.fleet_maintenance_entries(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        sort_order smallint NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.trip_attached_documents (
        id serial PRIMARY KEY,
        trip_id integer NOT NULL
          REFERENCES terminalops.trips(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        sort_order smallint NOT NULL DEFAULT 0
      );
    `);
  }
}
