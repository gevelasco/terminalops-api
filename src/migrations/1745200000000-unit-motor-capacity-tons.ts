import { MigrationInterface, QueryRunner } from 'typeorm';

/** Unidades: número de motor y capacidad en toneladas (nullable para registros existentes). */
export class UnitMotorCapacityTons1745200000000 implements MigrationInterface {
  name = 'UnitMotorCapacityTons1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.units
        ADD COLUMN IF NOT EXISTS motor_number text NULL;
      ALTER TABLE terminalops.units
        ADD COLUMN IF NOT EXISTS capacity_tons numeric(10, 2) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.units DROP COLUMN IF EXISTS capacity_tons;
      ALTER TABLE terminalops.units DROP COLUMN IF EXISTS motor_number;
    `);
  }
}
