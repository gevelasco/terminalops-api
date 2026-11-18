import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reportes filtra maniobras por completed_at / client_collected_at
 * y suma gastos por trip_id. Índices parciales para esas lecturas.
 */
export class ReportsPeriodIndexes1752950000000 implements MigrationInterface {
  name = 'ReportsPeriodIndexes1752950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_completed_at_alive
        ON terminalops.trips (company_id, completed_at)
        WHERE deleted_at IS NULL
          AND status = 'completed'
          AND completed_at IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_collected_at_alive
        ON terminalops.trips (company_id, client_collected_at)
        WHERE deleted_at IS NULL
          AND client_collected_at IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_company_trip_alive
        ON terminalops.expenses (company_id, trip_id)
        WHERE discarded_at IS NULL
          AND trip_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_expenses_company_trip_alive`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_company_collected_at_alive`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_company_completed_at_alive`,
    );
  }
}
