import { MigrationInterface, QueryRunner } from 'typeorm';

export class RbacRolesModuleAccess1744500000000 implements MigrationInterface {
  name = 'RbacRolesModuleAccess1744500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.app_user
        DROP CONSTRAINT IF EXISTS app_user_role_check;
    `);

    await queryRunner.query(`
      UPDATE terminalops.app_user
      SET role = 'staff'
      WHERE role IN ('coordinator', 'operator', 'viewer');
    `);

    await queryRunner.query(`
      UPDATE terminalops.app_user
      SET role = 'superadmin'
      WHERE lower(username) IN ('gvelasco', 'svelasco');
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.app_user
        ADD CONSTRAINT app_user_role_check
        CHECK (role IN ('superadmin', 'admin', 'staff'));
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS app_user_one_superadmin_per_company_idx
        ON terminalops.app_user (company_id)
        WHERE role = 'superadmin';
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.user_module_access (
        user_id integer NOT NULL REFERENCES terminalops.app_user(id) ON DELETE CASCADE,
        module_code text NOT NULL,
        PRIMARY KEY (user_id, module_code),
        CONSTRAINT user_module_access_module_code_check CHECK (
          module_code IN ('trips', 'fleet', 'operators', 'clients', 'expenses', 'reports')
        )
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.user_module_access;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.app_user_one_superadmin_per_company_idx;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.app_user
        DROP CONSTRAINT IF EXISTS app_user_role_check;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.app_user
        ADD CONSTRAINT app_user_role_check
        CHECK (role IN ('admin', 'coordinator', 'operator', 'viewer'));
    `);
  }
}
