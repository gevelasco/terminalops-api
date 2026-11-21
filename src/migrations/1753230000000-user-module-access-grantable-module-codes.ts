import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extiende user_module_access.module_code al catálogo RBAC actual
 * (dashboard, destination_rates, etc.).
 */
export class UserModuleAccessGrantableModuleCodes1753230000000
  implements MigrationInterface
{
  name = 'UserModuleAccessGrantableModuleCodes1753230000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
        DROP CONSTRAINT IF EXISTS user_module_access_module_code_check;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
        ADD CONSTRAINT user_module_access_module_code_check
        CHECK (
          module_code IN (
            'dashboard',
            'trips',
            'fleet',
            'operators',
            'clients',
            'destination_rates',
            'expenses',
            'reports'
          )
        );
    `);

    await queryRunner.query(`
      INSERT INTO terminalops.user_module_access (user_id, module_code, access_level)
      SELECT c.user_id, 'destination_rates', c.access_level
      FROM terminalops.user_module_access c
      WHERE c.module_code = 'clients'
        AND NOT EXISTS (
          SELECT 1
          FROM terminalops.user_module_access dr
          WHERE dr.user_id = c.user_id
            AND dr.module_code = 'destination_rates'
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM terminalops.user_module_access
      WHERE module_code IN ('dashboard', 'destination_rates');
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
        DROP CONSTRAINT IF EXISTS user_module_access_module_code_check;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.user_module_access
        ADD CONSTRAINT user_module_access_module_code_check
        CHECK (
          module_code IN (
            'trips',
            'fleet',
            'operators',
            'clients',
            'expenses',
            'reports'
          )
        );
    `);
  }
}