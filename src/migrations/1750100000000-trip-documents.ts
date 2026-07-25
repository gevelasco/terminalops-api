import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documentos de maniobra segmentados por sección (carga / costos / cobro),
 * con object storage (Railway/Tigris via FileService).
 */
export class TripDocuments1750100000000 implements MigrationInterface {
  name = 'TripDocuments1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.trip_documents (
        id serial PRIMARY KEY,
        trip_id integer NOT NULL REFERENCES terminalops.trips(id) ON DELETE CASCADE,
        document_kind text NOT NULL,
        file_name text NOT NULL,
        storage_key text NULL,
        content_type text NULL,
        size_bytes bigint NULL,
        sort_order smallint NOT NULL DEFAULT 0,
        CONSTRAINT trip_documents_kind_chk CHECK (
          document_kind IN (
            'load',
            'operational_costs',
            'billing',
            'empty_delivery'
          )
        )
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_documents_trip_id_idx
        ON terminalops.trip_documents (trip_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_documents_storage_key_idx
        ON terminalops.trip_documents (storage_key)
        WHERE storage_key IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trip_documents_storage_key_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trip_documents_trip_id_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_documents;
    `);
  }
}
