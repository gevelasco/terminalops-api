import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft delete de flota: la unicidad de placa aplica solo a unidades activas,
 * para poder reutilizar placa tras dar de baja.
 */
export class FleetActiveUniqueIndexes1750200000000
  implements MigrationInterface
{
  name = 'FleetActiveUniqueIndexes1750200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.units_company_plate_uniq;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS units_company_plate_active_uniq
        ON terminalops.units (company_id, plate)
        WHERE is_active = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.units_company_plate_active_uniq;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS units_company_plate_uniq
        ON terminalops.units (company_id, plate);
    `);
  }
}
