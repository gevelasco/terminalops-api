import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperatorImssDailyInsuredAmount1752930000000
  implements MigrationInterface
{
  name = 'OperatorImssDailyInsuredAmount1752930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operator_public_insurance
        ADD COLUMN IF NOT EXISTS daily_insured_amount numeric(12,2) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operator_public_insurance
        DROP COLUMN IF EXISTS daily_insured_amount;
    `);
  }
}
