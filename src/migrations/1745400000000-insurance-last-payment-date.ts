import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsuranceLastPaymentDate1745400000000 implements MigrationInterface {
  name = 'InsuranceLastPaymentDate1745400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.unit_fleet_profiles
  ADD COLUMN IF NOT EXISTS insurance_last_payment_date date;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.equipment_fleet_profiles
  ADD COLUMN IF NOT EXISTS insurance_last_payment_date date;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.unit_fleet_profiles
  DROP COLUMN IF EXISTS insurance_last_payment_date;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.equipment_fleet_profiles
  DROP COLUMN IF EXISTS insurance_last_payment_date;
`);
  }
}
