import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Exención de verificación físico-mecánica se calcula solo con equipment.trailer_year.
 * No hace falta flag de agencia ni fecha de inicio en profile.
 */
export class DropEquipmentAgencyExemptionFields1749000000000
  implements MigrationInterface
{
  name = 'DropEquipmentAgencyExemptionFields1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        DROP COLUMN IF EXISTS equipment_operated_by_agency,
        DROP COLUMN IF EXISTS phys_mech_two_year_exempt_start_date;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        ADD COLUMN IF NOT EXISTS equipment_operated_by_agency boolean,
        ADD COLUMN IF NOT EXISTS phys_mech_two_year_exempt_start_date date;
    `);
  }
}
