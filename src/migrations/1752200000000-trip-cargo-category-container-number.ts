import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clasificación de mercancía (tipo de carga) y número ISO de contenedor.
 */
export class TripCargoCategoryContainerNumber1752200000000
  implements MigrationInterface
{
  name = 'TripCargoCategoryContainerNumber1752200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS cargo_category text NOT NULL DEFAULT 'material',
        ADD COLUMN IF NOT EXISTS container_number text NULL;
    `);

    await queryRunner.query(`
      UPDATE terminalops.trips
      SET cargo_category = 'contenedor'
      WHERE cargo_category = 'material'
        AND container_type IS NOT NULL
        AND trim(container_type) <> ''
        AND container_type <> 'na';
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
