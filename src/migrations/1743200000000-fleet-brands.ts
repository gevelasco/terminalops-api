import { MigrationInterface, QueryRunner } from 'typeorm';

export class FleetBrands1743200000000 implements MigrationInterface {
  name = 'FleetBrands1743200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.fleet_brands (
        id serial PRIMARY KEY,
        company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        type text NOT NULL CHECK (type IN ('UNIT', 'EQUIPMENT')),
        name text NOT NULL,
        name_normalized text NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fleet_brands_company_type_name_normalized_key
          UNIQUE (company_id, type, name_normalized)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_brands_company_id_idx
        ON terminalops.fleet_brands (company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_brands_company_id_type_idx
        ON terminalops.fleet_brands (company_id, type);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_brands_company_id_is_active_idx
        ON terminalops.fleet_brands (company_id, is_active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.fleet_brands;`);
  }
}
