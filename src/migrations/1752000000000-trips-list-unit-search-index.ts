import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Búsqueda de maniobras por unidad: primero se resuelven ids en `units`
 * (catálogo chico) y luego `trips.unit_id IN (...)`.
 * Cubre company + unidad + sort de lista sin filesort.
 */
export class TripsListUnitSearchIndex1752000000000 implements MigrationInterface {
  name = 'TripsListUnitSearchIndex1752000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_company_unit_created_alive
        ON terminalops.trips (company_id, unit_id, created_at DESC)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_company_unit_created_alive`,
    );
  }
}
