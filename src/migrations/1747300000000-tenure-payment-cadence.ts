import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenurePaymentCadence1747300000000 implements MigrationInterface {
  name = 'TenurePaymentCadence1747300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_asset_tenure
      ADD COLUMN IF NOT EXISTS recurring_payment_cadence varchar NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_asset_tenure
      ADD COLUMN IF NOT EXISTS recurring_last_payment_date date NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_asset_tenure
      DROP COLUMN IF EXISTS recurring_last_payment_date;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_asset_tenure
      DROP COLUMN IF EXISTS recurring_payment_cadence;
    `);
  }
}
