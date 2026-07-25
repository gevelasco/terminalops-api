import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Object storage keys for unit fleet documents (Railway/Tigris via FileService).
 * Legacy rows keep only file_name; new uploads populate storage_key.
 */
export class UnitFleetDocumentStorage1749700000000 implements MigrationInterface {
  name = 'UnitFleetDocumentStorage1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_documents
        ADD COLUMN IF NOT EXISTS storage_key text NULL,
        ADD COLUMN IF NOT EXISTS content_type text NULL,
        ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS unit_fleet_documents_storage_key_idx
        ON terminalops.unit_fleet_documents (storage_key)
        WHERE storage_key IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.unit_fleet_documents_storage_key_idx;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_documents
        DROP COLUMN IF EXISTS size_bytes,
        DROP COLUMN IF EXISTS content_type,
        DROP COLUMN IF EXISTS storage_key;
    `);
  }
}
