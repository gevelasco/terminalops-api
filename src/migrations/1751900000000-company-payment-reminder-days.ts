import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyPaymentReminderDays1751900000000 implements MigrationInterface {
  name = 'CompanyPaymentReminderDays1751900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS payment_reminder_days_before integer NOT NULL DEFAULT 5;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP CONSTRAINT IF EXISTS companies_payment_reminder_days_before_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD CONSTRAINT companies_payment_reminder_days_before_chk
        CHECK (payment_reminder_days_before >= 1 AND payment_reminder_days_before <= 15);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP CONSTRAINT IF EXISTS companies_payment_reminder_days_before_chk;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS payment_reminder_days_before;
    `);
  }
}
