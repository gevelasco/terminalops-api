import { MigrationInterface, QueryRunner } from 'typeorm';

/** portal_username no se usará; el autor de bitácora es username de torre. */
export class DropOperatorPortalUsername1748800000000 implements MigrationInterface {
  name = 'DropOperatorPortalUsername1748800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.operators_company_portal_username_uniq;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.operators_portal_username_key;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        DROP COLUMN IF EXISTS portal_username;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.operators
        ADD COLUMN IF NOT EXISTS portal_username text;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS operators_company_portal_username_uniq
        ON terminalops.operators (company_id, portal_username)
        WHERE portal_username IS NOT NULL;
    `);
  }
}
