import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserThemePreference1740700000000 implements MigrationInterface {
  name = 'AddUserThemePreference1740700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
      ADD COLUMN IF NOT EXISTS theme_scheme text NOT NULL DEFAULT 'light'
      CHECK (theme_scheme IN ('light', 'dark'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
      DROP COLUMN IF EXISTS theme_scheme;
    `);
  }
}
