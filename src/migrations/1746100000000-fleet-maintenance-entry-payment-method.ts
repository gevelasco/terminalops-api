import { MigrationInterface, QueryRunner } from 'typeorm';

export class FleetMaintenanceEntryPaymentMethod1746100000000
  implements MigrationInterface
{
  name = 'FleetMaintenanceEntryPaymentMethod1746100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
      ADD COLUMN IF NOT EXISTS payment_method text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
      DROP COLUMN IF EXISTS payment_method
    `);
  }
}
