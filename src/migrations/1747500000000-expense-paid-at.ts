import { MigrationInterface, QueryRunner } from 'typeorm';

const SCHEMA = process.env.TERMINALOPS_SCHEMA || 'terminalops';

export class ExpensePaidAt1747500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "${SCHEMA}"."expenses"
      ADD COLUMN "paid_at" timestamptz DEFAULT NULL
    `);

    await queryRunner.query(`
      UPDATE "${SCHEMA}"."expenses"
      SET "paid_at" = "incurred_at"
      WHERE "kind" IN ('insurance', 'gps', 'tenure_payment')
        AND "discarded_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "${SCHEMA}"."expenses"
      DROP COLUMN IF EXISTS "paid_at"
    `);
  }
}
