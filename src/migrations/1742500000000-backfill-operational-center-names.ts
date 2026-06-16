import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillOperationalCenterNames1742500000000
  implements MigrationInterface
{
  name = 'BackfillOperationalCenterNames1742500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
UPDATE terminalops.operational_centers
SET name = 'Centro Principal'
WHERE name IS NULL OR trim(name) = '';
`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: backfill is idempotent and non-destructive.
  }
}
