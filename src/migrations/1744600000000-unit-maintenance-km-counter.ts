import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnitMaintenanceKmCounter1744600000000 implements MigrationInterface {
  name = 'UnitMaintenanceKmCounter1744600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS maintenance_km_counter numeric(12,2) NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles p
      SET maintenance_km_counter = GREATEST(
        0,
        COALESCE(
          NULLIF(p.maintenance_km_interval, 0),
          (
            SELECT NULLIF(c.maintenance_km_interval_default, 0)
            FROM terminalops.units u
            INNER JOIN terminalops.companies c ON c.id = u.company_id
            WHERE u.id = p.unit_id
          ),
          0
        ) - COALESCE(p.maintenance_km_remaining, 0)
      )
      WHERE p.maintenance_km_remaining IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS maintenance_km_counter;
    `);
  }
}
