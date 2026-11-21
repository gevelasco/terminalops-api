import { MigrationInterface, QueryRunner } from 'typeorm';

export class FleetMaintenanceEntryDocumentNames1752960000000
  implements MigrationInterface
{
  name = 'FleetMaintenanceEntryDocumentNames1752960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        ADD COLUMN IF NOT EXISTS document_file_names text[] NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
        DROP COLUMN IF EXISTS document_file_names;
    `);
  }
}