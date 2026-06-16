import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationalCentersAndRateRoutes1742400000000
  implements MigrationInterface
{
  name = 'OperationalCentersAndRateRoutes1742400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
CREATE TABLE IF NOT EXISTS terminalops.operational_centers (
  id serial PRIMARY KEY,
  company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Centro Principal',
  code varchar(32) NOT NULL DEFAULT 'MAIN',
  postal_code varchar(5),
  city_municipality text,
  locality text,
  settlement_cons_id varchar(32),
  latitude numeric(10,7),
  longitude numeric(10,7),
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_operational_centers_company
  ON terminalops.operational_centers (company_id);
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_operational_centers_company_code
  ON terminalops.operational_centers (company_id, lower(code));
`);

    await queryRunner.query(`
INSERT INTO terminalops.operational_centers (
  company_id,
  name,
  code,
  postal_code,
  city_municipality,
  locality,
  settlement_cons_id,
  latitude,
  longitude,
  is_default
)
SELECT
  c.id,
  'Centro Principal',
  'MAIN',
  c.operational_center_postal_code,
  c.operational_center_city_municipality,
  c.operational_center_locality,
  c.operational_center_settlement_cons_id,
  c.operational_center_latitude,
  c.operational_center_longitude,
  true
FROM terminalops.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM terminalops.operational_centers oc WHERE oc.company_id = c.id
);
`);

    await queryRunner.query(`
ALTER TABLE terminalops.companies
  ADD COLUMN IF NOT EXISTS primary_operational_center_id integer;
`);
    await queryRunner.query(`
UPDATE terminalops.companies c
SET primary_operational_center_id = oc.id
FROM terminalops.operational_centers oc
WHERE oc.company_id = c.id
  AND oc.is_default = true
  AND c.primary_operational_center_id IS NULL;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.companies
  ADD CONSTRAINT fk_companies_primary_operational_center
  FOREIGN KEY (primary_operational_center_id)
  REFERENCES terminalops.operational_centers(id)
  ON DELETE SET NULL;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.destination_rates
  ADD COLUMN IF NOT EXISTS origin_operational_center_id integer,
  ADD COLUMN IF NOT EXISTS origin_postal_code varchar(5) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS origin_city_municipality text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS origin_locality text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS origin_latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS origin_longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS destination_latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS destination_longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS route_distance_km numeric(10,2),
  ADD COLUMN IF NOT EXISTS operational_distance_km numeric(10,2),
  ADD COLUMN IF NOT EXISTS is_round_trip boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS distance_calculated_at timestamptz;
`);

    await queryRunner.query(`
UPDATE terminalops.destination_rates dr
SET
  origin_operational_center_id = c.primary_operational_center_id,
  origin_postal_code = COALESCE(oc.postal_code, ''),
  origin_city_municipality = COALESCE(oc.city_municipality, ''),
  origin_locality = COALESCE(oc.locality, ''),
  origin_latitude = oc.latitude,
  origin_longitude = oc.longitude
FROM terminalops.companies c
LEFT JOIN terminalops.operational_centers oc
  ON oc.id = c.primary_operational_center_id
WHERE dr.company_id = c.id
  AND dr.origin_operational_center_id IS NULL;
`);

    await queryRunner.query(`
UPDATE terminalops.destination_rates dr
SET origin_operational_center_id = oc.id
FROM terminalops.operational_centers oc
WHERE dr.origin_operational_center_id IS NULL
  AND oc.company_id = dr.company_id
  AND oc.is_default = true;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.destination_rates
  ALTER COLUMN origin_operational_center_id SET NOT NULL;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.destination_rates
  ADD CONSTRAINT fk_destination_rates_origin_operational_center
  FOREIGN KEY (origin_operational_center_id)
  REFERENCES terminalops.operational_centers(id)
  ON DELETE RESTRICT;
`);

    await queryRunner.query(`
DROP INDEX IF EXISTS terminalops.uq_destination_rates_company_postal_locality;
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_company_origin_dest_locality
  ON terminalops.destination_rates (
    company_id,
    origin_operational_center_id,
    postal_code,
    locality
  );
`);

    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD COLUMN IF NOT EXISTS destination_rate_id integer;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.trips
  ADD CONSTRAINT fk_trips_destination_rate
  FOREIGN KEY (destination_rate_id)
  REFERENCES terminalops.destination_rates(id)
  ON DELETE SET NULL;
`);
    await queryRunner.query(`
CREATE INDEX IF NOT EXISTS idx_trips_destination_rate_id
  ON terminalops.trips (destination_rate_id);
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS terminalops.idx_trips_destination_rate_id;`);
    await queryRunner.query(`
ALTER TABLE terminalops.trips DROP CONSTRAINT IF EXISTS fk_trips_destination_rate;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.trips DROP COLUMN IF EXISTS destination_rate_id;
`);

    await queryRunner.query(`
DROP INDEX IF EXISTS terminalops.uq_destination_rates_company_origin_dest_locality;
`);
    await queryRunner.query(`
CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_company_postal_locality
  ON terminalops.destination_rates (company_id, postal_code, locality);
`);

    await queryRunner.query(`
ALTER TABLE terminalops.destination_rates
  DROP CONSTRAINT IF EXISTS fk_destination_rates_origin_operational_center;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.destination_rates
  DROP COLUMN IF EXISTS origin_operational_center_id,
  DROP COLUMN IF EXISTS origin_postal_code,
  DROP COLUMN IF EXISTS origin_city_municipality,
  DROP COLUMN IF EXISTS origin_locality,
  DROP COLUMN IF EXISTS origin_latitude,
  DROP COLUMN IF EXISTS origin_longitude,
  DROP COLUMN IF EXISTS destination_latitude,
  DROP COLUMN IF EXISTS destination_longitude,
  DROP COLUMN IF EXISTS route_distance_km,
  DROP COLUMN IF EXISTS operational_distance_km,
  DROP COLUMN IF EXISTS is_round_trip,
  DROP COLUMN IF EXISTS distance_calculated_at;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.companies
  DROP CONSTRAINT IF EXISTS fk_companies_primary_operational_center;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.companies
  DROP COLUMN IF EXISTS primary_operational_center_id;
`);

    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.operational_centers;`);
  }
}
