import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adjuntos de datos fiscales / facturación del cliente (metadatos).
 * Misma idea que operator_documents: nombre + slot + fecha; binario vía storage después.
 */
export class ClientDocuments1750300000000 implements MigrationInterface {
  name = 'ClientDocuments1750300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.client_documents (
        id serial PRIMARY KEY,
        client_id integer NOT NULL
          REFERENCES terminalops.clients(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        slot text NOT NULL CHECK (slot IN ('fiscal')),
        added_at date NOT NULL,
        sort_order smallint NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS client_documents_client_id_idx
        ON terminalops.client_documents (client_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.client_documents_client_id_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.client_documents;
    `);
  }
}
