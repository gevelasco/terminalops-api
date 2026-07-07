import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCompaniesOperationalCenterLegacy1744000000000
  implements MigrationInterface
{
  name = 'DropCompaniesOperationalCenterLegacy1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS operational_center_postal_code,
        DROP COLUMN IF EXISTS operational_center_city_municipality,
        DROP COLUMN IF EXISTS operational_center_locality,
        DROP COLUMN IF EXISTS operational_center_settlement_cons_id,
        DROP COLUMN IF EXISTS operational_center_latitude,
        DROP COLUMN IF EXISTS operational_center_longitude;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS operational_center_postal_code varchar(5),
        ADD COLUMN IF NOT EXISTS operational_center_city_municipality text,
        ADD COLUMN IF NOT EXISTS operational_center_locality text,
        ADD COLUMN IF NOT EXISTS operational_center_settlement_cons_id varchar(32),
        ADD COLUMN IF NOT EXISTS operational_center_latitude numeric(10,7),
        ADD COLUMN IF NOT EXISTS operational_center_longitude numeric(10,7);
    `);
  }
}
