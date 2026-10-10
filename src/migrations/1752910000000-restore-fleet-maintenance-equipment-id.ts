import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revierte en BD local/PRD el drop de `equipment_id` en fleet_maintenance_entries
 * (migración experimental 175290 que ya no forma parte del producto).
 * Idempotente: no-op si la columna ya existe.
 */
export class RestoreFleetMaintenanceEquipmentId1752910000000
  implements MigrationInterface
{
  name = 'RestoreFleetMaintenanceEquipmentId1752910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP CONSTRAINT IF EXISTS fleet_maintenance_entries_owner_chk;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ALTER COLUMN unit_id DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ADD COLUMN IF NOT EXISTS equipment_id integer
          REFERENCES terminalops.equipment(id) ON DELETE CASCADE;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP CONSTRAINT IF EXISTS fleet_maintenance_entries_owner_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ADD CONSTRAINT fleet_maintenance_entries_owner_chk
        CHECK (
          (unit_id IS NOT NULL AND equipment_id IS NULL)
          OR (unit_id IS NULL AND equipment_id IS NOT NULL)
        );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_maintenance_entries_equipment_id_idx
        ON terminalops.fleet_maintenance_entries (equipment_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_entries_equipment_latest
        ON terminalops.fleet_maintenance_entries (
          equipment_id,
          sort_order DESC,
          entry_date DESC
        )
        WHERE equipment_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_fleet_maintenance_entries_equipment_latest;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_maintenance_entries_equipment_id_idx;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP CONSTRAINT IF EXISTS fleet_maintenance_entries_owner_chk;
    `);
    await queryRunner.query(`
      DELETE FROM terminalops.fleet_maintenance_entries
      WHERE equipment_id IS NOT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP COLUMN IF EXISTS equipment_id;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ALTER COLUMN unit_id SET NOT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ADD CONSTRAINT fleet_maintenance_entries_owner_chk
        CHECK (unit_id IS NOT NULL);
    `);
  }
}
