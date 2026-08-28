import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lista de maniobras: company_id + deleted_at IS NULL + ORDER BY created_at DESC.
 * Parciales (solo vivas) para no indexar soft-deletes y cubrir el sort sin
 * filesort. El tab de estatus usa la variante con status.
 */
export class TripsListCreatedAtIndexes1751700000000 implements MigrationInterface {
  name = 'TripsListCreatedAtIndexes1751700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_created_alive
        ON terminalops.trips (company_id, created_at DESC)
        WHERE deleted_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_status_created_alive
        ON terminalops.trips (company_id, status, created_at DESC)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_company_status_created_alive`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_company_created_alive`,
    );
  }
}
