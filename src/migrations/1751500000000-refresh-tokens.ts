import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokens1751500000000 implements MigrationInterface {
  name = 'RefreshTokens1751500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id int NOT NULL REFERENCES terminalops.app_user (id) ON DELETE CASCADE,
        jti uuid NOT NULL,
        token_hash text NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz NULL,
        replaced_by_jti uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_jti_uidx
        ON terminalops.refresh_tokens (jti);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_uidx
        ON terminalops.refresh_tokens (token_hash);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
        ON terminalops.refresh_tokens (user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.refresh_tokens;
    `);
  }
}
