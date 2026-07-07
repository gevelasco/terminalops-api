import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperatorPaymentSchedule1746300000000 implements MigrationInterface {
  name = 'OperatorPaymentSchedule1746300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
      ADD COLUMN IF NOT EXISTS payment_schedule varchar NOT NULL DEFAULT 'maneuver';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
      DROP COLUMN IF EXISTS payment_schedule;
    `);
  }
}
