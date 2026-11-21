import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tiempos estimados solo en horas; elimina `estimated_time_unit`. */
export class DestinationRateEstimatedHoursOnly1752980000000
  implements MigrationInterface
{
  name = 'DestinationRateEstimatedHoursOnly1752980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.destination_rates
      SET estimated_arrival_time_value = estimated_arrival_time_value * 24
      WHERE estimated_time_unit = 'days'
        AND estimated_arrival_time_value IS NOT NULL;

      UPDATE terminalops.destination_rates
      SET estimated_return_time_value = estimated_return_time_value * 24
      WHERE estimated_time_unit = 'days'
        AND estimated_return_time_value IS NOT NULL;

      ALTER TABLE terminalops.destination_rates
        DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_complete;

      ALTER TABLE terminalops.destination_rates
        DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_unit;

      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS estimated_time_unit;

      ALTER TABLE terminalops.destination_rates
        ADD CONSTRAINT chk_destination_rates_estimated_time_complete
        CHECK (
          (
            estimated_arrival_time_value IS NULL
            AND estimated_return_time_value IS NULL
          )
          OR (
            estimated_arrival_time_value IS NOT NULL
            AND estimated_arrival_time_value > 0
            AND estimated_return_time_value IS NOT NULL
            AND estimated_return_time_value > 0
          )
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP CONSTRAINT IF EXISTS chk_destination_rates_estimated_time_complete;

      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS estimated_time_unit varchar(5) NULL;

      ALTER TABLE terminalops.destination_rates
        ADD CONSTRAINT chk_destination_rates_estimated_time_unit
        CHECK (
          estimated_time_unit IS NULL
          OR estimated_time_unit IN ('hours', 'days')
        );

      UPDATE terminalops.destination_rates
      SET estimated_time_unit = 'hours'
      WHERE estimated_arrival_time_value IS NOT NULL
        AND estimated_return_time_value IS NOT NULL;

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
        );
    `);
  }
}