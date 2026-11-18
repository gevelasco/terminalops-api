import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperatorImssSalaryType1752940000000 implements MigrationInterface {
  name = 'OperatorImssSalaryType1752940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operator_public_insurance
        ADD COLUMN IF NOT EXISTS salary_type varchar(16) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operator_public_insurance
        DROP COLUMN IF EXISTS salary_type;
    `);
  }
}
