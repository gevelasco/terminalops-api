import { MigrationInterface, QueryRunner } from 'typeorm';

export class DestinationRateEstimatedToll1742200000000 implements MigrationInterface {
  name = 'DestinationRateEstimatedToll1742200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rate_prices
      ADD COLUMN IF NOT EXISTS estimated_toll_amount numeric(12, 2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rate_prices
      DROP COLUMN IF EXISTS estimated_toll_amount
    `);
  }
}
