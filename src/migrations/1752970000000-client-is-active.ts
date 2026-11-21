import { MigrationInterface, QueryRunner } from 'typeorm';

/** Clientes: soft delete (`is_active`); ocultos en catálogo comercial, historial en maniobras intacto. */
export class ClientIsActive1752970000000 implements MigrationInterface {
  name = 'ClientIsActive1752970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.clients
        ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
      CREATE INDEX IF NOT EXISTS clients_company_id_is_active_idx
        ON terminalops.clients (company_id, is_active);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.clients_company_id_is_active_idx;
      ALTER TABLE terminalops.clients DROP COLUMN IF EXISTS is_active;
    `);
  }
}