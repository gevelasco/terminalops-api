import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripAutoOperationalControlLabel1753240000000
  implements MigrationInterface
{
  name = 'TripAutoOperationalControlLabel1753240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS trip_auto_operational_control_label varchar(80) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      DROP COLUMN IF EXISTS trip_auto_operational_control_label
    `);
  }
}