import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tabla legacy; documentos en `fleet_maintenance_entries.document_file_names` + fleet docs. */
export class DropFleetMaintenanceEntryDocuments1753260000000
  implements MigrationInterface
{
  name = 'DropFleetMaintenanceEntryDocuments1753260000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_maintenance_entry_documents;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.fleet_maintenance_entry_documents (
        id serial PRIMARY KEY,
        maintenance_entry_id integer NOT NULL
          REFERENCES terminalops.fleet_maintenance_entries(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        sort_order smallint NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_maintenance_entry_documents_entry_idx
        ON terminalops.fleet_maintenance_entry_documents (maintenance_entry_id);
    `);
  }
}