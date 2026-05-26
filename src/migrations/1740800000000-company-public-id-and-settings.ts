import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyPublicIdAndSettings1740800000000 implements MigrationInterface {
  name = 'CompanyPublicIdAndSettings1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS public_id integer;

      CREATE SEQUENCE IF NOT EXISTS terminalops.companies_public_id_seq;

      UPDATE terminalops.companies
      SET public_id = nextval('terminalops.companies_public_id_seq')
      WHERE public_id IS NULL;

      ALTER TABLE terminalops.companies
      ALTER COLUMN public_id SET NOT NULL;

      ALTER TABLE terminalops.companies
      ADD CONSTRAINT companies_public_id_uniq UNIQUE (public_id);

      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS operational_analysis_enabled boolean NOT NULL DEFAULT true;

      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS operational_analysis_changed_at timestamptz NOT NULL DEFAULT now();

      ALTER TABLE terminalops.app_user
      ADD COLUMN IF NOT EXISTS public_id integer;

      CREATE SEQUENCE IF NOT EXISTS terminalops.app_user_public_id_seq;

      UPDATE terminalops.app_user
      SET public_id = nextval('terminalops.app_user_public_id_seq')
      WHERE public_id IS NULL;

      ALTER TABLE terminalops.app_user
      ALTER COLUMN public_id SET NOT NULL;

      ALTER TABLE terminalops.app_user
      ADD CONSTRAINT app_user_public_id_uniq UNIQUE (public_id);

      ALTER TABLE terminalops.app_user
      ADD COLUMN IF NOT EXISTS phone text;

      ALTER TABLE terminalops.companies
      ALTER COLUMN public_id SET DEFAULT nextval('terminalops.companies_public_id_seq');

      ALTER TABLE terminalops.app_user
      ALTER COLUMN public_id SET DEFAULT nextval('terminalops.app_user_public_id_seq');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.app_user DROP COLUMN IF EXISTS phone;
      ALTER TABLE terminalops.app_user DROP CONSTRAINT IF EXISTS app_user_public_id_uniq;
      ALTER TABLE terminalops.app_user DROP COLUMN IF EXISTS public_id;
      DROP SEQUENCE IF EXISTS terminalops.app_user_public_id_seq;

      ALTER TABLE terminalops.companies DROP COLUMN IF EXISTS operational_analysis_changed_at;
      ALTER TABLE terminalops.companies DROP COLUMN IF EXISTS operational_analysis_enabled;
      ALTER TABLE terminalops.companies DROP CONSTRAINT IF EXISTS companies_public_id_uniq;
      ALTER TABLE terminalops.companies DROP COLUMN IF EXISTS public_id;
      DROP SEQUENCE IF EXISTS terminalops.companies_public_id_seq;
    `);
  }
}
