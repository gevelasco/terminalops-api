import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyPaymentReminderAndAutoPaymentsChangedAt1753250000000
  implements MigrationInterface
{
  name = 'CompanyPaymentReminderAndAutoPaymentsChangedAt1753250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS payment_reminder_days_changed_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS trip_auto_payments_changed_at TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      UPDATE terminalops.companies
      SET
        payment_reminder_days_changed_at = COALESCE(
          payment_reminder_days_changed_at,
          operational_analysis_changed_at,
          updated_at,
          created_at
        ),
        trip_auto_payments_changed_at = COALESCE(
          trip_auto_payments_changed_at,
          operational_analysis_changed_at,
          updated_at,
          created_at
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      DROP COLUMN IF EXISTS trip_auto_payments_changed_at,
      DROP COLUMN IF EXISTS payment_reminder_days_changed_at
    `);
  }
}