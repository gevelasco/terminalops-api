import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperatorWeeklyPayDay1752500000000 implements MigrationInterface {
  name = 'OperatorWeeklyPayDay1752500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
      ADD COLUMN IF NOT EXISTS weekly_pay_day varchar NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
      DROP COLUMN IF EXISTS weekly_pay_day;
    `);
  }
}
