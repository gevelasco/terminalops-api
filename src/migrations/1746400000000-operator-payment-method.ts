import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperatorPaymentMethod1746400000000 implements MigrationInterface {
  name = 'OperatorPaymentMethod1746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
      ADD COLUMN IF NOT EXISTS payment_method varchar NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
      DROP COLUMN IF EXISTS payment_method;
    `);
  }
}
