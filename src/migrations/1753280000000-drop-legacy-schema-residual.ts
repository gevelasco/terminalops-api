import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Limpieza residual: tablas/columnas sin entity ni writers en código actual.
 * Casetas viven en `destination_rates.route_toll_plazas`; mantenimiento en fleet docs.
 */
export class DropLegacySchemaResidual1753280000000 implements MigrationInterface {
  name = 'DropLegacySchemaResidual1753280000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_route_booth_prices;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_route_booths;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_routes;
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_attached_documents;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_trip_id;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_trip_audit_events_company_id;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_audit_events;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_created_at_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_entity_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_status_events;
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_maintenance_entry_documents;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS is_round_trip;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS is_round_trip,
        DROP COLUMN IF EXISTS toll_route_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No recrea tablas muertas; usar migraciones históricas si hace falta en dev.
  }
}