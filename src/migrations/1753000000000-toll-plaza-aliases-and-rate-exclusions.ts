import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo de nombres de casetas (INEGI N/D) y exclusiones por tarifa operativa.
 */
export class TollPlazaAliasesAndRateExclusions1753000000000
  implements MigrationInterface
{
  name = 'TollPlazaAliasesAndRateExclusions1753000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE terminalops.toll_plaza_aliases (
        id SERIAL PRIMARY KEY,
        company_id INT NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        plaza_key VARCHAR(64) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_toll_plaza_aliases_company_key UNIQUE (company_id, plaza_key)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_toll_plaza_aliases_company
        ON terminalops.toll_plaza_aliases (company_id);
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS excluded_toll_plaza_keys JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS excluded_toll_plaza_keys;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_plaza_aliases;
    `);
  }
}