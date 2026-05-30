import { MigrationInterface, QueryRunner } from 'typeorm';

export class DestinationRates1741600000000 implements MigrationInterface {
  name = 'DestinationRates1741600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.destination_rates (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
  postal_code varchar(5) NOT NULL,
  city_municipality text NOT NULL DEFAULT '',
  locality text NOT NULL DEFAULT '',
  simple_rate numeric(12,2) NOT NULL DEFAULT 0,
  full_rate numeric(12,2) NOT NULL DEFAULT 0,
  flatbed_rate numeric(12,2) NOT NULL DEFAULT 0,
  operator_payment_estimate numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_destination_rates_company_postal
  ON terminalops.destination_rates (company_id, postal_code);
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_company_postal_locality
  ON terminalops.destination_rates (company_id, postal_code, locality);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.destination_rates;`);
  }
}
