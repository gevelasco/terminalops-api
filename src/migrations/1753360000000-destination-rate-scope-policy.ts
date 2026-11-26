import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Política de tarifas por empresa (CP / municipio / estado) + columnas de
 * identidad geográfica en destination_rates + índices únicos por scope.
 */
export class DestinationRateScopePolicy1753360000000
  implements MigrationInterface
{
  name = 'DestinationRateScopePolicy1753360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS destination_rate_scope varchar(32)
        NOT NULL DEFAULT 'postal_code'
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      ADD COLUMN IF NOT EXISTS destination_scope varchar(32)
        NOT NULL DEFAULT 'postal_code'
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      ADD COLUMN IF NOT EXISTS route_key_incomplete boolean
        NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      ADD COLUMN IF NOT EXISTS municipality_name text NOT NULL DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      ADD COLUMN IF NOT EXISTS state_name text NOT NULL DEFAULT ''
    `);

    /* Backfill municipio/estado desde city_municipality cuando se pueda. */
    await queryRunner.query(`
      UPDATE terminalops.destination_rates
      SET
        municipality_name = CASE
          WHEN position(',' in city_municipality) > 0
            THEN trim(both from split_part(city_municipality, ',', 1))
          ELSE trim(both from city_municipality)
        END,
        state_name = CASE
          WHEN position(',' in city_municipality) > 0
            THEN trim(both from substring(city_municipality from position(',' in city_municipality) + 1))
          ELSE ''
        END
      WHERE coalesce(trim(city_municipality), '') <> ''
        AND coalesce(trim(municipality_name), '') = ''
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.uq_destination_rates_company_origin_dest_locality
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_scope_postal
      ON terminalops.destination_rates (
        company_id,
        origin_operational_center_id,
        postal_code,
        lower(btrim(locality))
      )
      WHERE destination_scope = 'postal_code'
        AND route_key_incomplete = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_scope_municipality
      ON terminalops.destination_rates (
        company_id,
        origin_operational_center_id,
        lower(btrim(state_name)),
        lower(btrim(municipality_name))
      )
      WHERE destination_scope = 'municipality'
        AND route_key_incomplete = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_scope_state
      ON terminalops.destination_rates (
        company_id,
        origin_operational_center_id,
        lower(btrim(state_name))
      )
      WHERE destination_scope = 'state'
        AND route_key_incomplete = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.uq_destination_rates_scope_state
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.uq_destination_rates_scope_municipality
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.uq_destination_rates_scope_postal
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_destination_rates_company_origin_dest_locality
      ON terminalops.destination_rates (
        company_id,
        origin_operational_center_id,
        postal_code,
        lower(btrim(locality))
      )
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP COLUMN IF EXISTS state_name
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP COLUMN IF EXISTS municipality_name
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP COLUMN IF EXISTS route_key_incomplete
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
      DROP COLUMN IF EXISTS destination_scope
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      DROP COLUMN IF EXISTS destination_rate_scope
    `);
  }
}
