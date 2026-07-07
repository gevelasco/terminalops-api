import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyDieselReferencePrice1744900000000 implements MigrationInterface {
  name = 'CompanyDieselReferencePrice1744900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS diesel_reference_price_per_liter numeric(10, 4),
        ADD COLUMN IF NOT EXISTS diesel_reference_price_updated_at timestamptz,
        ADD COLUMN IF NOT EXISTS diesel_reference_price_updated_by_user_id integer;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS diesel_reference_price_updated_by_user_id,
        DROP COLUMN IF EXISTS diesel_reference_price_updated_at,
        DROP COLUMN IF EXISTS diesel_reference_price_per_liter;
    `);
  }
}
