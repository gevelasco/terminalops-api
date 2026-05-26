import { MigrationInterface, QueryRunner } from 'typeorm';

/** Demo tenant: gvelasco / Admin123 (misma credencial que el mock del frontend). */
export class SeedDevTenant1740600000000 implements MigrationInterface {
  name = 'SeedDevTenant1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const companyId = '00000000-0000-4000-8000-000000000001';
    const userId = '00000000-0000-4000-8000-000000000002';
    const passwordHash =
      '$2b$10$IhLA05gGapvXuGeTE7gne.sT5f3h1w8Qeh4pTx38QWdj4mOkghcD6';

    await queryRunner.query(`
      INSERT INTO terminalops.companies (id, name, subscription_status, subscription_plan)
      VALUES ('${companyId}', 'TerminalOps Demo', 'active', 'trial')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO terminalops.app_user (
        id, company_id, username, display_name, email, password_hash, role, status
      )
      VALUES (
        '${userId}',
        '${companyId}',
        'gvelasco',
        'Germán Velasco',
        'gvelasco@terminalops.demo',
        '${passwordHash}',
        'admin',
        'active'
      )
      ON CONFLICT DO NOTHING;

      INSERT INTO terminalops.user_preferences (user_id, theme_scheme)
      VALUES ('${userId}', 'light')
      ON CONFLICT (user_id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM terminalops.app_user WHERE id = '00000000-0000-4000-8000-000000000002';
      DELETE FROM terminalops.companies WHERE id = '00000000-0000-4000-8000-000000000001';
    `);
  }
}
