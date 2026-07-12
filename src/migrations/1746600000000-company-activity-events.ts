import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyActivityEvents1746600000000 implements MigrationInterface {
  name = 'CompanyActivityEvents1746600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.company_activity_events (
        id bigserial PRIMARY KEY,
        company_id integer NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        kind text NOT NULL,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        subject_label text NOT NULL,
        title text NOT NULL,
        actor_user_id integer NULL REFERENCES terminalops.app_user(id) ON DELETE SET NULL,
        actor_label text NOT NULL DEFAULT 'Sistema',
        occurred_at timestamptz NOT NULL DEFAULT now(),
        metadata jsonb NULL,
        dedupe_key text NULL
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS company_activity_events_company_dedupe_uq
      ON terminalops.company_activity_events (company_id, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS company_activity_events_company_occurred_idx
      ON terminalops.company_activity_events (company_id, occurred_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.company_activity_events_company_occurred_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.company_activity_events_company_dedupe_uq;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.company_activity_events;
    `);
  }
}
