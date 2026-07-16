import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenureBeneficiary1747400000000 implements MigrationInterface {
  public async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE terminalops.fleet_asset_tenure
        ADD COLUMN IF NOT EXISTS tenure_beneficiary TEXT;
    `);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE terminalops.fleet_asset_tenure
        DROP COLUMN IF EXISTS tenure_beneficiary;
    `);
  }
}
