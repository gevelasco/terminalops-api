import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupEmptyFleetMaintenanceEntries1746200000000
  implements MigrationInterface
{
  name = 'CleanupEmptyFleetMaintenanceEntries1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM terminalops.fleet_maintenance_entries
      WHERE entry_date IS NULL
        AND cost IS NULL
        AND (notes IS NULL OR btrim(notes) = '')
    `);
  }

  public async down(): Promise<void> {
    // No se restauran filas fantasma eliminadas.
  }
}
