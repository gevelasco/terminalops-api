import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsuranceCarrierName1740800000000 implements MigrationInterface {
  name = 'InsuranceCarrierName1740800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.unit_fleet_profiles
  ADD COLUMN IF NOT EXISTS insurance_carrier_name text;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.equipment_fleet_profiles
  ADD COLUMN IF NOT EXISTS insurance_carrier_name text;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.unit_fleet_profiles
  DROP COLUMN IF EXISTS insurance_carrier_name;
`);
    await queryRunner.query(`
ALTER TABLE terminalops.equipment_fleet_profiles
  DROP COLUMN IF EXISTS insurance_carrier_name;
`);
  }
}
