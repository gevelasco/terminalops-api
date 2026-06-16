import { MigrationInterface, QueryRunner } from 'typeorm';

export class ControlAutomaticRecognition1743000000000
  implements MigrationInterface
{
  name = 'ControlAutomaticRecognition1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        ADD COLUMN control_automatic_recognition boolean NOT NULL DEFAULT false,
        ADD COLUMN control_automatic_recognition_changed_at timestamptz NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        DROP COLUMN IF EXISTS control_automatic_recognition,
        DROP COLUMN IF EXISTS control_automatic_recognition_changed_at;
    `);
  }
}
