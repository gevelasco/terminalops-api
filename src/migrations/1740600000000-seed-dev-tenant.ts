import { MigrationInterface, QueryRunner } from 'typeorm';

/** Demo tenant: gvelasco / Admin123 (misma credencial que el mock del frontend). */
export class SeedDevTenant1740600000000 implements MigrationInterface {
  name = 'SeedDevTenant1740600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const passwordHash =
      '$2b$10$IhLA05gGapvXuGeTE7gne.sT5f3h1w8Qeh4pTx38QWdj4mOkghcD6';

    await queryRunner.query(`
      INSERT INTO terminalops.companies (id, name, subscription_status, subscription_plan)
      VALUES (1, 'TerminalOps Demo', 'active', 'trial')
      ON CONFLICT (id) DO NOTHING;

      SELECT setval(
        pg_get_serial_sequence('terminalops.companies', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM terminalops.companies), 1)
      );

      INSERT INTO terminalops.app_user (
        id, company_id, username, display_name, email, password_hash, role, status
      )
      VALUES (
        1,
        1,
        'gvelasco',
        'Germán Velasco',
        'gvelasco@terminalops.demo',
        '${passwordHash}',
        'admin',
        'active'
      )
      ON CONFLICT DO NOTHING;

      SELECT setval(
        pg_get_serial_sequence('terminalops.app_user', 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM terminalops.app_user), 1)
      );

      INSERT INTO terminalops.user_preferences (user_id, theme_scheme)
      VALUES (1, 'light')
      ON CONFLICT (user_id) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM terminalops.app_user WHERE id = 1;
      DELETE FROM terminalops.companies WHERE id = 1;
    `);
  }
}
