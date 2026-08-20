import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Borrar una unidad no debe vaciar el unit_id de maniobras ni gastos históricos.
 * La baja de flota es lógica (is_active); un DELETE físico debe fallar si hay historial.
 *
 * Timestamp propio: 175100 ya lo usa ClientDocumentStorage.
 */
export class TripUnitDeleteRestrict1751300000000 implements MigrationInterface {
  name = 'TripUnitDeleteRestrict1751300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_unit_id_fkey;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD CONSTRAINT trips_unit_id_fkey
        FOREIGN KEY (unit_id) REFERENCES terminalops.units(id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        DROP CONSTRAINT IF EXISTS expenses_related_unit_id_fkey;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        ADD CONSTRAINT expenses_related_unit_id_fkey
        FOREIGN KEY (related_unit_id) REFERENCES terminalops.units(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP CONSTRAINT IF EXISTS trips_unit_id_fkey;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD CONSTRAINT trips_unit_id_fkey
        FOREIGN KEY (unit_id) REFERENCES terminalops.units(id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        DROP CONSTRAINT IF EXISTS expenses_related_unit_id_fkey;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        ADD CONSTRAINT expenses_related_unit_id_fkey
        FOREIGN KEY (related_unit_id) REFERENCES terminalops.units(id) ON DELETE SET NULL;
    `);
  }
}
