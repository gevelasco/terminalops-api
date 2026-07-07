import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyOperationalSettingsV21744400000000
  implements MigrationInterface
{
  name = 'CompanyOperationalSettingsV21744400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN trip_assist_prefill_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN trip_assist_prefill_changed_at timestamptz NULL,
        ADD COLUMN trip_auto_maintenance_provision_percent numeric(5,2) NOT NULL DEFAULT 5;
    `);

    await queryRunner.query(`
      UPDATE terminalops.companies c
      SET trip_assist_prefill_enabled = COALESCE(src.enabled, false)
      FROM (
        SELECT u.company_id, bool_or(p.control_automatic_recognition) AS enabled
        FROM terminalops.app_user u
        INNER JOIN terminalops.user_preferences p ON p.user_id = u.id
        GROUP BY u.company_id
      ) src
      WHERE c.id = src.company_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS trip_assist_prefill_enabled,
        DROP COLUMN IF EXISTS trip_assist_prefill_changed_at,
        DROP COLUMN IF EXISTS trip_auto_maintenance_provision_percent;
    `);
  }
}
