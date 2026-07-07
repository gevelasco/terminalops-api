import { MigrationInterface, QueryRunner } from 'typeorm';

/** Soft delete de maniobras y descarte lógico de gastos vinculados. */
export class TripSoftDeleteExpenseDiscard1745100000000 implements MigrationInterface {
  name = 'TripSoftDeleteExpenseDiscard1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS deleted_by text NULL;
      CREATE INDEX IF NOT EXISTS trips_company_id_deleted_at_idx
        ON terminalops.trips (company_id, deleted_at);

      ALTER TABLE terminalops.expenses
        ADD COLUMN IF NOT EXISTS discarded_at timestamptz NULL;
      CREATE INDEX IF NOT EXISTS expenses_company_id_discarded_at_idx
        ON terminalops.expenses (company_id, discarded_at);
      CREATE INDEX IF NOT EXISTS expenses_trip_id_discarded_at_idx
        ON terminalops.expenses (trip_id, discarded_at)
        WHERE trip_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.expenses_trip_id_discarded_at_idx;
      DROP INDEX IF EXISTS terminalops.expenses_company_id_discarded_at_idx;
      ALTER TABLE terminalops.expenses DROP COLUMN IF EXISTS discarded_at;

      DROP INDEX IF EXISTS terminalops.trips_company_id_deleted_at_idx;
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS deleted_by,
        DROP COLUMN IF EXISTS deleted_at;
    `);
  }
}
