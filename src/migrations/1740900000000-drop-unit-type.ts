import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUnitType1740900000000 implements MigrationInterface {
  name = 'DropUnitType1740900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.units
      DROP COLUMN IF EXISTS type
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.units
      ADD COLUMN type text NOT NULL DEFAULT ''
    `);
  }
}

