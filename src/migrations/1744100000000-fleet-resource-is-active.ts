import { MigrationInterface, QueryRunner } from 'typeorm';

/** Flota: soft delete lógico (`is_active`) separado del estado operativo (`status`). */
export class FleetResourceIsActive1744100000000 implements MigrationInterface {
  name = 'FleetResourceIsActive1744100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.units
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
      CREATE INDEX IF NOT EXISTS units_company_id_is_active_idx
        ON terminalops.units (company_id, is_active);

      ALTER TABLE terminalops.equipment
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
      CREATE INDEX IF NOT EXISTS equipment_company_id_is_active_idx
        ON terminalops.equipment (company_id, is_active);

      ALTER TABLE terminalops.operators
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
      CREATE INDEX IF NOT EXISTS operators_company_id_is_active_idx
        ON terminalops.operators (company_id, is_active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.operators_company_id_is_active_idx;
      ALTER TABLE terminalops.operators DROP COLUMN IF EXISTS is_active;

      DROP INDEX IF EXISTS terminalops.equipment_company_id_is_active_idx;
      ALTER TABLE terminalops.equipment DROP COLUMN IF EXISTS is_active;

      DROP INDEX IF EXISTS terminalops.units_company_id_is_active_idx;
      ALTER TABLE terminalops.units DROP COLUMN IF EXISTS is_active;
    `);
  }
}
