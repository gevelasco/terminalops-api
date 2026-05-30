import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripDieselPriceSnapshot1741400000000 implements MigrationInterface {
  name = 'TripDieselPriceSnapshot1741400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN diesel_price_per_liter_at_creation numeric(10, 4) NULL;
    `);

    await queryRunner.query(`
      UPDATE terminalops.trips
      SET diesel_price_per_liter_at_creation = ROUND(
        (diesel_amount::numeric / NULLIF(diesel_liters::numeric, 0)),
        4
      )
      WHERE diesel_price_per_liter_at_creation IS NULL
        AND diesel_amount IS NOT NULL
        AND diesel_liters IS NOT NULL
        AND diesel_liters::numeric > 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS diesel_price_per_liter_at_creation;
    `);
  }
}
