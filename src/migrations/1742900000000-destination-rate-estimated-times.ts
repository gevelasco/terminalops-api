import { MigrationInterface, QueryRunner } from 'typeorm';

export class DestinationRateEstimatedTimes1742900000000 implements MigrationInterface {
  name = 'DestinationRateEstimatedTimes1742900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      ADD COLUMN IF NOT EXISTS estimated_arrival_time_value numeric(10, 2) NULL,
      ADD COLUMN IF NOT EXISTS estimated_return_time_value numeric(10, 2) NULL,
      ADD COLUMN IF NOT EXISTS estimated_time_unit varchar(5) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_unit
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      ADD CONSTRAINT chk_destination_rates_estimated_time_unit
      CHECK (
        estimated_time_unit IS NULL
        OR estimated_time_unit IN ('hours', 'days')
      )
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_complete
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      ADD CONSTRAINT chk_destination_rates_estimated_time_complete
      CHECK (
        (
          estimated_arrival_time_value IS NULL
          AND estimated_return_time_value IS NULL
          AND estimated_time_unit IS NULL
        )
        OR (
          estimated_arrival_time_value IS NOT NULL
          AND estimated_arrival_time_value > 0
          AND estimated_return_time_value IS NOT NULL
          AND estimated_return_time_value > 0
          AND estimated_time_unit IS NOT NULL
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_complete
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_unit
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP COLUMN IF EXISTS estimated_arrival_time_value,
      DROP COLUMN IF EXISTS estimated_return_time_value,
      DROP COLUMN IF EXISTS estimated_time_unit
    `);
  }
}
