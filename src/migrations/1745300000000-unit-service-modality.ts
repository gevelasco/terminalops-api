import { MigrationInterface, QueryRunner } from 'typeorm';

/** Unidades: modalidad de autotransporte federal de carga (nullable). */
export class UnitServiceModality1745300000000 implements MigrationInterface {
  name = 'UnitServiceModality1745300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS service_modality text NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS service_modality;
    `);
  }
}
