import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserModuleAccessLevel1746500000000 implements MigrationInterface {
  name = 'UserModuleAccessLevel1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
      ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'write';
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
      DROP CONSTRAINT IF EXISTS user_module_access_access_level_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
      ADD CONSTRAINT user_module_access_access_level_check
      CHECK (access_level IN ('read', 'write'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
      DROP CONSTRAINT IF EXISTS user_module_access_access_level_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
      DROP COLUMN IF EXISTS access_level;
    `);
  }
}
