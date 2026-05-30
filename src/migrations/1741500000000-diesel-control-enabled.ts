import { MigrationInterface, QueryRunner } from 'typeorm';

export class DieselControlEnabled1741500000000 implements MigrationInterface {
  name = 'DieselControlEnabled1741500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        ADD COLUMN diesel_control_enabled boolean NOT NULL DEFAULT true,
        ADD COLUMN diesel_control_changed_at timestamptz NULL;
    `);

    await queryRunner.query(`
      UPDATE terminalops.companies
      SET diesel_control_changed_at = now()
      WHERE diesel_control_changed_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.companies
        DROP COLUMN IF EXISTS diesel_control_enabled,
        DROP COLUMN IF EXISTS diesel_control_changed_at;
    `);
  }
}
