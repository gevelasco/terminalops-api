import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserProfileFields1740900000000 implements MigrationInterface {
  name = 'AddUserProfileFields1740900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.app_user
      ADD COLUMN IF NOT EXISTS job_title text;

      ALTER TABLE terminalops.app_user
      ADD COLUMN IF NOT EXISTS photo_data_url text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.app_user DROP COLUMN IF EXISTS photo_data_url;
      ALTER TABLE terminalops.app_user DROP COLUMN IF EXISTS job_title;
    `);
  }
}
