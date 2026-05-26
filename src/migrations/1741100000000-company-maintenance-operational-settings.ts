import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyMaintenanceOperationalSettings1741100000000
  implements MigrationInterface
{
  name = 'CompanyMaintenanceOperationalSettings1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN IF NOT EXISTS maintenance_km_control_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS maintenance_km_interval_default numeric(10,2),
        ADD COLUMN IF NOT EXISTS maintenance_date_control_enabled boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS maintenance_date_period_default text
          CHECK (
            maintenance_date_period_default IS NULL
            OR maintenance_date_period_default IN ('monthly', 'quarterly', 'semiannual', 'annual')
          );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS maintenance_date_period_default,
        DROP COLUMN IF EXISTS maintenance_date_control_enabled,
        DROP COLUMN IF EXISTS maintenance_km_interval_default,
        DROP COLUMN IF EXISTS maintenance_km_control_enabled;
    `);
  }
}
