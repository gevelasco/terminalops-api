import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Versiones por marca + reinicio del catálogo dinámico (sin backfill histórico).
 *
 * Impacto: los datos en fleet_brands (si existían) se eliminan.
 * Las unidades/equipos conservan trailer_brand_name y trailer_version en sus perfiles;
 * el catálogo se reconstruye conforme se guarden registros nuevos.
 */
export class FleetBrandVersions1743300000000 implements MigrationInterface {
  name = 'FleetBrandVersions1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.fleet_brand_versions (
        id serial PRIMARY KEY,
        brand_id integer NOT NULL REFERENCES terminalops.fleet_brands(id) ON DELETE CASCADE,
        name text NOT NULL,
        name_normalized text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fleet_brand_versions_brand_name_normalized_key
          UNIQUE (brand_id, name_normalized)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_brand_versions_brand_id_idx
        ON terminalops.fleet_brand_versions (brand_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_brand_versions_is_active_idx
        ON terminalops.fleet_brand_versions (is_active);
    `);

    await queryRunner.query(`
      TRUNCATE terminalops.fleet_brand_versions;
    `);
    await queryRunner.query(`
      TRUNCATE terminalops.fleet_brands RESTART IDENTITY CASCADE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.fleet_brand_versions;`);
  }
}
