import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserPreferencesOperationalAnalysis1743600000000
  implements MigrationInterface
{
  name = 'DropUserPreferencesOperationalAnalysis1743600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        DROP COLUMN IF EXISTS operational_analysis_enabled,
        DROP COLUMN IF EXISTS operational_analysis_changed_at;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        ADD COLUMN IF NOT EXISTS operational_analysis_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS operational_analysis_changed_at timestamptz NOT NULL DEFAULT now();
    `);
  }
}
