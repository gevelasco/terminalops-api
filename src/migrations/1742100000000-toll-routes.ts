import { MigrationInterface, QueryRunner } from 'typeorm';

export class TollRoutes1742100000000 implements MigrationInterface {
  name = 'TollRoutes1742100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.toll_routes (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
  origin_postal_code varchar(5) NOT NULL,
  destination_postal_code varchar(5) NOT NULL,
  route_hash varchar(32) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_toll_routes_company_route_hash
  ON terminalops.toll_routes (company_id, route_hash);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_toll_routes_company_postal_pair
  ON terminalops.toll_routes (company_id, origin_postal_code, destination_postal_code);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.toll_route_booths (
  id serial PRIMARY KEY,
  toll_route_id integer NOT NULL REFERENCES terminalops.toll_routes(id) ON DELETE CASCADE,
  booth_name text NOT NULL,
  order_index smallint NOT NULL DEFAULT 0
);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_toll_route_booths_route_order
  ON terminalops.toll_route_booths (toll_route_id, order_index);
`);
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.toll_route_booth_prices (
  id serial PRIMARY KEY,
  booth_id integer NOT NULL REFERENCES terminalops.toll_route_booths(id) ON DELETE CASCADE,
  operation_configuration_id integer NOT NULL
    REFERENCES terminalops.company_operation_configurations(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_toll_booth_price_config UNIQUE (booth_id, operation_configuration_id)
);
`);
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS toll_route_id integer
    REFERENCES terminalops.toll_routes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS toll_calculation_mode varchar(16),
  ADD COLUMN IF NOT EXISTS route_toll_amount numeric(14,2);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP COLUMN IF EXISTS route_toll_amount,
  DROP COLUMN IF EXISTS toll_calculation_mode,
  DROP COLUMN IF EXISTS toll_route_id;
`);
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.toll_route_booth_prices;`);
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.toll_route_booths;`);
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.toll_routes;`);
  }
}
