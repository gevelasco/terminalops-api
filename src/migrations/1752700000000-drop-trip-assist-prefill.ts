import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTripAssistPrefill1752700000000 implements MigrationInterface {
  name = 'DropTripAssistPrefill1752700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS trip_assist_prefill_enabled,
        DROP COLUMN IF EXISTS trip_assist_prefill_changed_at;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        DROP COLUMN IF EXISTS control_automatic_recognition,
        DROP COLUMN IF EXISTS control_automatic_recognition_changed_at;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN trip_assist_prefill_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN trip_assist_prefill_changed_at timestamptz NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        ADD COLUMN control_automatic_recognition boolean NOT NULL DEFAULT false,
        ADD COLUMN control_automatic_recognition_changed_at timestamptz NULL;
    `);
  }
}
