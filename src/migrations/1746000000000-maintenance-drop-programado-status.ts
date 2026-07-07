import { MigrationInterface, QueryRunner } from 'typeorm';

export class MaintenanceDropProgramadoStatus1746000000000
  implements MigrationInterface
{
  name = 'MaintenanceDropProgramadoStatus1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.fleet_maintenance_entries
      SET status = 'concluido'
      WHERE status = 'programado'
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
      DROP CONSTRAINT IF EXISTS fleet_maintenance_entries_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
      ADD CONSTRAINT fleet_maintenance_entries_status_check
      CHECK (status IS NULL OR status = 'concluido')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
      DROP CONSTRAINT IF EXISTS fleet_maintenance_entries_status_check
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.fleet_maintenance_entries
      ADD CONSTRAINT fleet_maintenance_entries_status_check
      CHECK (status IS NULL OR status IN ('programado', 'concluido'))
    `);
  }
}
