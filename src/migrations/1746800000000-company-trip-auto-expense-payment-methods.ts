import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyTripAutoExpensePaymentMethods1746800000000
  implements MigrationInterface
{
  name = 'CompanyTripAutoExpensePaymentMethods1746800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS trip_auto_fuel_payment_method varchar(32) NOT NULL DEFAULT 'cash',
      ADD COLUMN IF NOT EXISTS trip_auto_tolls_payment_method varchar(32) NOT NULL DEFAULT 'cash',
      ADD COLUMN IF NOT EXISTS trip_auto_per_diem_payment_method varchar(32) NOT NULL DEFAULT 'cash';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      DROP COLUMN IF EXISTS trip_auto_fuel_payment_method,
      DROP COLUMN IF EXISTS trip_auto_tolls_payment_method,
      DROP COLUMN IF EXISTS trip_auto_per_diem_payment_method;
    `);
  }
}
