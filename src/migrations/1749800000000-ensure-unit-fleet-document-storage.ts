import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotent ensure for unit document storage columns.
 * Covers Railway drift when migrations_list is ahead of real DDL
 * (or 174970 did not apply for any reason).
 */
export class EnsureUnitFleetDocumentStorage1749800000000
  implements MigrationInterface
{
  name = 'EnsureUnitFleetDocumentStorage1749800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_documents
        ADD COLUMN IF NOT EXISTS storage_key text NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_documents
        ADD COLUMN IF NOT EXISTS content_type text NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_documents
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
        DROP COLUMN IF EXISTS size_bytes;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_documents
        DROP COLUMN IF EXISTS content_type;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_documents
        DROP COLUMN IF EXISTS storage_key;
    `);
  }
}
