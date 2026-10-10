import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flota /overview y assignable lists:
 * - MAX(last ended) por unidad en maniobras completed
 * - join trip_equipment → trips completed (días sin maniobra en equipos)
 * - NOT EXISTS maniobras scheduled/in_transit por unidad/operador/equipo
 * - GET /fleet/insurance-table-compliance (kind insurance + rango incurred_at)
 */
export class FleetOverviewPerfIndexes1752920000000 implements MigrationInterface {
  name = 'FleetOverviewPerfIndexes1752920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_fleet_overview_completed_last_end_unit
        ON terminalops.trips (
          company_id,
          unit_id,
          (COALESCE(return_at, completed_at)) DESC
        )
        WHERE deleted_at IS NULL
          AND status = 'completed'
          AND unit_id IS NOT NULL
          AND COALESCE(return_at, completed_at) IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_fleet_overview_completed_alive
        ON terminalops.trips (company_id, id)
        WHERE deleted_at IS NULL
          AND status = 'completed'
          AND COALESCE(return_at, completed_at) IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_fleet_active_by_unit
        ON terminalops.trips (company_id, unit_id)
        WHERE deleted_at IS NULL
          AND status IN ('scheduled', 'in_transit')
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_fleet_active_by_operator
        ON terminalops.trips (company_id, operator_id)
        WHERE deleted_at IS NULL
          AND status IN ('scheduled', 'in_transit')
          AND operator_id IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_trip_equipment_equipment_trip
        ON terminalops.trip_equipment (equipment_id, trip_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_company_insurance_incurred_alive
        ON terminalops.expenses (company_id, incurred_at)
        WHERE discarded_at IS NULL
          AND kind = 'insurance'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_expenses_company_insurance_incurred_alive`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trip_equipment_equipment_trip`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_fleet_active_by_operator`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_fleet_active_by_unit`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_fleet_overview_completed_alive`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS terminalops.idx_trips_fleet_overview_completed_last_end_unit`,
    );
  }
}
