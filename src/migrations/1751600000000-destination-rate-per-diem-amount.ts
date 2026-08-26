import { MigrationInterface, QueryRunner } from 'typeorm';

export class DestinationRatePerDiemAmount1751600000000 implements MigrationInterface {
  name = 'DestinationRatePerDiemAmount1751600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rate_prices
      ADD COLUMN IF NOT EXISTS per_diem_amount numeric(12, 2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rate_prices
      DROP COLUMN IF EXISTS per_diem_amount
    `);
  }
}
