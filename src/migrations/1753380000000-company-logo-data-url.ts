import { MigrationInterface, QueryRunner } from 'typeorm';

/** Logo de empresa en cuenta (data URL), mismo patrón que photo_data_url de usuario. */
export class CompanyLogoDataUrl1753380000000 implements MigrationInterface {
  name = 'CompanyLogoDataUrl1753380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS logo_data_url text NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS logo_data_url;
    `);
  }
}
