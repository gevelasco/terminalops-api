import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * destination_rates hygiene:
 * - drop toll_routes* (muertas)
 * - drop operational_distance_km / is_round_trip (siempre ida×2 en código)
 * - unique route con lower(btrim(locality))
 */
export class CleanupDestinationRatesAndDropTollRoutes1749100000000
  implements MigrationInterface
{
  name = 'CleanupDestinationRatesAndDropTollRoutes1749100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // trips.toll_route_id ya se dropeó en 174820; tablas toll_* sin consumidores
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_route_booth_prices;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_route_booths;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_routes;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS is_round_trip;
    `);

    // Reapunta trips/client_delivery a la tarifa canónica antes de borrar duplicados case-insensitive
    await queryRunner.query(`
      WITH dups AS (
        SELECT
          id,
          FIRST_VALUE(id) OVER (
            PARTITION BY
              company_id,
              origin_operational_center_id,
              postal_code,
              lower(btrim(locality))
            ORDER BY id ASC
          ) AS keep_id
        FROM terminalops.destination_rates
      )
      UPDATE terminalops.trips t
      SET destination_rate_id = d.keep_id
      FROM dups d
      WHERE t.destination_rate_id = d.id
        AND d.id <> d.keep_id;
    `);
    await queryRunner.query(`
      WITH dups AS (
        SELECT
          id,
          FIRST_VALUE(id) OVER (
            PARTITION BY
              company_id,
              origin_operational_center_id,
              postal_code,
              lower(btrim(locality))
            ORDER BY id ASC
          ) AS keep_id
        FROM terminalops.destination_rates
      )
      UPDATE terminalops.client_delivery cd
      SET destination_rate_id = d.keep_id
      FROM dups d
      WHERE cd.destination_rate_id = d.id
        AND d.id <> d.keep_id;
    `);
    await queryRunner.query(`
      DELETE FROM terminalops.destination_rates dr
      USING (
        SELECT
          id,
          FIRST_VALUE(id) OVER (
            PARTITION BY
              company_id,
              origin_operational_center_id,
              postal_code,
              lower(btrim(locality))
            ORDER BY id ASC
          ) AS keep_id
        FROM terminalops.destination_rates
      ) d
      WHERE dr.id = d.id
        AND d.id <> d.keep_id;
    `);

    await queryRunner.query(`
      UPDATE terminalops.destination_rates
      SET locality = btrim(locality)
      WHERE locality IS DISTINCT FROM btrim(locality);
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.uq_destination_rates_company_origin_dest_locality;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_destination_rates_company_origin_dest_locality
        ON terminalops.destination_rates (
          company_id,
          origin_operational_center_id,
          postal_code,
          lower(btrim(locality))
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.uq_destination_rates_company_origin_dest_locality;
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
      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS operational_distance_km numeric(10, 2),
        ADD COLUMN IF NOT EXISTS is_round_trip boolean NOT NULL DEFAULT true;
    `);
    await queryRunner.query(`
      UPDATE terminalops.destination_rates
      SET operational_distance_km = route_distance_km::numeric * 2
      WHERE route_distance_km IS NOT NULL
        AND operational_distance_km IS NULL;
    `);

    // down: no recrea toll_routes* (tablas muertas; 174210 las creó si hace falta re-seed)
  }
}
