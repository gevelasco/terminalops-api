import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Checklist personal por usuario (persiste entre sesiones).
 */
export class UserChecklistTodos1750800000000 implements MigrationInterface {
  name = 'UserChecklistTodos1750800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.user_checklist_todos (
        id serial PRIMARY KEY,
        company_id integer NOT NULL
          REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        user_id integer NOT NULL
          REFERENCES terminalops.app_user(id) ON DELETE CASCADE,
        text text NOT NULL,
        completed boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT user_checklist_todos_text_not_blank
          CHECK (btrim(text) <> '')
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS user_checklist_todos_user_company_idx
        ON terminalops.user_checklist_todos (user_id, company_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS user_checklist_todos_company_created_idx
        ON terminalops.user_checklist_todos (company_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.user_checklist_todos_company_created_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.user_checklist_todos_user_company_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.user_checklist_todos;
    `);
  }
}
