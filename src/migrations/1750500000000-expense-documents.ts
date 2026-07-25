import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adjuntos de comprobantes / facturas del gasto (metadatos).
 * Misma idea que client_documents: nombre + slot + fecha; binario vía storage después.
 */
export class ExpenseDocuments1750500000000 implements MigrationInterface {
  name = 'ExpenseDocuments1750500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.expense_documents (
        id serial PRIMARY KEY,
        expense_id integer NOT NULL
          REFERENCES terminalops.expenses(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        slot text NOT NULL CHECK (slot IN ('receipt')),
        added_at date NOT NULL,
        sort_order smallint NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS expense_documents_expense_id_idx
        ON terminalops.expense_documents (expense_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.expense_documents_expense_id_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.expense_documents;
    `);
  }
}
