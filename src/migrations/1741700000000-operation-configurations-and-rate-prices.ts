import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationConfigurationsAndRatePrices1741700000000
  implements MigrationInterface
{
  name = 'OperationConfigurationsAndRatePrices1741700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.company_operation_configurations (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
  code varchar(64) NOT NULL,
  name text NOT NULL,
  max_equipment_count smallint NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_operation_configurations_company_code
  ON terminalops.company_operation_configurations (company_id, code);
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_operation_configurations_company_name
  ON terminalops.company_operation_configurations (company_id, lower(trim(name)));
`);

    await queryRunner.query(`
INSERT INTO terminalops.company_operation_configurations (company_id, code, name, max_equipment_count)
SELECT c.id, v.code, v.name, v.max_equipment_count
FROM terminalops.companies c
CROSS JOIN (
  VALUES
    ('sencillo', 'Sencillo', 1::smallint),
    ('full', 'Doble articulado', 2::smallint),
    ('plana', 'Plana', 1::smallint)
) AS v(code, name, max_equipment_count)
ON CONFLICT DO NOTHING;
`);

    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.destination_rate_prices (
  id serial PRIMARY KEY,
  destination_rate_id integer NOT NULL REFERENCES terminalops.destination_rates(id) ON DELETE CASCADE,
  operation_configuration_id integer NOT NULL REFERENCES terminalops.company_operation_configurations(id) ON DELETE RESTRICT,
  client_charge numeric(12,2) NOT NULL DEFAULT 0,
  operator_payment_estimate numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rate_prices_rate_config
  ON terminalops.destination_rate_prices (destination_rate_id, operation_configuration_id);
`);

    await queryRunner.query(`
INSERT INTO terminalops.destination_rate_prices (
  destination_rate_id,
  operation_configuration_id,
  client_charge,
  operator_payment_estimate
)
SELECT dr.id, cfg.id, dr.simple_rate, dr.operator_payment_estimate
FROM terminalops.destination_rates dr
JOIN terminalops.company_operation_configurations cfg
  ON cfg.company_id = dr.company_id AND cfg.code = 'sencillo'
WHERE dr.simple_rate > 0 OR dr.operator_payment_estimate > 0
ON CONFLICT DO NOTHING;
`);
    await queryRunner.query(`
INSERT INTO terminalops.destination_rate_prices (
  destination_rate_id,
  operation_configuration_id,
  client_charge,
  operator_payment_estimate
)
SELECT dr.id, cfg.id, dr.full_rate, 0
FROM terminalops.destination_rates dr
JOIN terminalops.company_operation_configurations cfg
  ON cfg.company_id = dr.company_id AND cfg.code = 'full'
WHERE dr.full_rate > 0
ON CONFLICT DO NOTHING;
`);
    await queryRunner.query(`
INSERT INTO terminalops.destination_rate_prices (
  destination_rate_id,
  operation_configuration_id,
  client_charge,
  operator_payment_estimate
)
SELECT dr.id, cfg.id, dr.flatbed_rate, 0
FROM terminalops.destination_rates dr
JOIN terminalops.company_operation_configurations cfg
  ON cfg.company_id = dr.company_id AND cfg.code = 'plana'
WHERE dr.flatbed_rate > 0
ON CONFLICT DO NOTHING;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.destination_rates
  DROP COLUMN IF EXISTS simple_rate,
  DROP COLUMN IF EXISTS full_rate,
  DROP COLUMN IF EXISTS flatbed_rate,
  DROP COLUMN IF EXISTS operator_payment_estimate;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  DROP CONSTRAINT IF EXISTS trips_operation_type_check;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.destination_rates
  ADD COLUMN IF NOT EXISTS simple_rate numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS full_rate numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flatbed_rate numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operator_payment_estimate numeric(12,2) NOT NULL DEFAULT 0;
`);
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.destination_rate_prices;`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS terminalops.company_operation_configurations;`,
    );
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD CONSTRAINT trips_operation_type_check
  CHECK (operation_type IN ('sencillo', 'full', 'plana'));
`);
  }
}
