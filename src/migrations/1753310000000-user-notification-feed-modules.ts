import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserNotificationFeedModules1753310000000
  implements MigrationInterface
{
  name = 'UserNotificationFeedModules1753310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        ADD COLUMN IF NOT EXISTS notification_feed_modules jsonb NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_preferences
        DROP COLUMN IF EXISTS notification_feed_modules;
    `);
  }
}