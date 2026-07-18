import { MigrationInterface, QueryRunner } from 'typeorm';

/** Unidades: configuración del vehículo motriz de carga. */
export class UnitTransportType1747800000000 implements MigrationInterface {
  name = 'UnitTransportType1747800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.units
        ADD COLUMN IF NOT EXISTS transport_type text NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.units
        DROP COLUMN IF EXISTS transport_type;
    `);
  }
}
