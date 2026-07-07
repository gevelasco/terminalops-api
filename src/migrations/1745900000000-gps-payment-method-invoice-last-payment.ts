import { MigrationInterface, QueryRunner } from 'typeorm';

export class GpsPaymentMethodInvoiceLastPayment1745900000000
  implements MigrationInterface
{
  name = 'GpsPaymentMethodInvoiceLastPayment1745900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS gps_last_payment_date date,
        ADD COLUMN IF NOT EXISTS gps_payment_method text,
        ADD COLUMN IF NOT EXISTS gps_invoice_required boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS gps_last_payment_date,
        DROP COLUMN IF EXISTS gps_payment_method,
        DROP COLUMN IF EXISTS gps_invoice_required
    `);
  }
}
