import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyTagline1747200000000 implements MigrationInterface {
  name = 'CompanyTagline1747200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS tagline varchar NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      DROP COLUMN IF EXISTS tagline;
    `);
  }
}
