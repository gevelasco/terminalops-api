import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripOperatorUnitSnapshots1742300000000 implements MigrationInterface {
  name = 'TripOperatorUnitSnapshots1742300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
      ADD COLUMN IF NOT EXISTS operator_name_snapshot text,
      ADD COLUMN IF NOT EXISTS unit_operational_code_snapshot text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
      DROP COLUMN IF EXISTS operator_name_snapshot,
      DROP COLUMN IF EXISTS unit_operational_code_snapshot
    `);
  }
}
