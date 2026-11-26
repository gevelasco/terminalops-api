import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPushSubscriptions1753320000000 implements MigrationInterface {
  name = 'UserPushSubscriptions1753320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.user_push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL
          REFERENCES terminalops.app_user(id) ON DELETE CASCADE,
        company_id INT NOT NULL
          REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_push_subscriptions_endpoint UNIQUE (endpoint)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_user_id
        ON terminalops.user_push_subscriptions (user_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_push_subscriptions_company_id
        ON terminalops.user_push_subscriptions (company_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.user_push_subscriptions;
    `);
  }
}
