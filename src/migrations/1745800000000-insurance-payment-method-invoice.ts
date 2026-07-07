import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsurancePaymentMethodInvoice1745800000000
  implements MigrationInterface
{
  name = 'InsurancePaymentMethodInvoice1745800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS insurance_payment_method text,
        ADD COLUMN IF NOT EXISTS insurance_invoice_required boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        ADD COLUMN IF NOT EXISTS insurance_payment_method text,
        ADD COLUMN IF NOT EXISTS insurance_invoice_required boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        DROP COLUMN IF EXISTS insurance_invoice_required,
        DROP COLUMN IF EXISTS insurance_payment_method
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS insurance_invoice_required,
        DROP COLUMN IF EXISTS insurance_payment_method
    `);
  }
}
