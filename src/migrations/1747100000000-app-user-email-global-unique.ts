import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Login por correo: el email debe ser único en toda la app (no solo por empresa).
 * El username sigue único por (company_id, username).
 */
export class AppUserEmailGlobalUnique1747100000000 implements MigrationInterface {
  name = 'AppUserEmailGlobalUnique1747100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.app_user_company_email_uniq;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        dup_count integer;
      BEGIN
        SELECT COUNT(*)::integer INTO dup_count
        FROM (
          SELECT LOWER(btrim(email)) AS e
          FROM terminalops.app_user
          WHERE email IS NOT NULL AND btrim(email) <> ''
          GROUP BY LOWER(btrim(email))
          HAVING COUNT(*) > 1
        ) d;

        IF dup_count > 0 THEN
          RAISE EXCEPTION
            'AppUserEmailGlobalUnique: hay % correos duplicados entre empresas; corrígelos antes de migrar',
            dup_count;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS app_user_email_global_uniq
        ON terminalops.app_user (LOWER(btrim(email)))
        WHERE email IS NOT NULL AND btrim(email) <> '';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.app_user_email_global_uniq;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS app_user_company_email_uniq
        ON terminalops.app_user (company_id, email)
        WHERE email IS NOT NULL;
    `);
  }
}
