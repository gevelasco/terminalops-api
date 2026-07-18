import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Maniobras: fecha/hora y lugar de carga. El lugar alimenta un catálogo por
 * empresa (trip_load_places) con el mismo patrón que fleet_brands.
 */
export class TripLoadDatePlace1748000000000 implements MigrationInterface {
  name = 'TripLoadDatePlace1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS load_date timestamptz NULL,
        ADD COLUMN IF NOT EXISTS load_place text NULL;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.trip_load_places (
        id serial PRIMARY KEY,
        company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        name text NOT NULL,
        name_normalized text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT trip_load_places_company_name_normalized_key
          UNIQUE (company_id, name_normalized)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_load_places_company_id_idx
        ON terminalops.trip_load_places (company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_load_places_company_id_is_active_idx
        ON terminalops.trip_load_places (company_id, is_active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_load_places;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS load_date,
        DROP COLUMN IF EXISTS load_place;
    `);
  }
}
