import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyTripAutoControlPaymentMethod1746900000000
  implements MigrationInterface
{
  name = 'CompanyTripAutoControlPaymentMethod1746900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      ADD COLUMN IF NOT EXISTS trip_auto_control_payment_method varchar(32) NOT NULL DEFAULT 'cash';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
      DROP COLUMN IF EXISTS trip_auto_control_payment_method;
    `);
  }
}
