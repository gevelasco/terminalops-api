import { MigrationInterface, QueryRunner } from 'typeorm';

export class FuelPrices1741300000000 implements MigrationInterface {
  name = 'FuelPrices1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE terminalops.fuel_prices (
        id serial PRIMARY KEY,
        fuel_type text NOT NULL,
        price_per_liter numeric(10, 4) NOT NULL,
        source text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_fuel_prices_type_created
        ON terminalops.fuel_prices (fuel_type, created_at DESC);
    `);

    await queryRunner.query(`
      INSERT INTO terminalops.fuel_prices (fuel_type, price_per_liter, source)
      VALUES ('diesel', 25.5000, 'config:seed');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.fuel_prices;`);
  }
}
