import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Casetas se modelan solo en `route_toll_plazas` (lista en ruta).
 * `excluded_toll_plaza_keys` quedó sin UI ni lógica de negocio.
 */
export class DropExcludedTollPlazaKeys1753370000000 implements MigrationInterface {
  name = 'DropExcludedTollPlazaKeys1753370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS excluded_toll_plaza_keys;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS excluded_toll_plaza_keys jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
  }
}
