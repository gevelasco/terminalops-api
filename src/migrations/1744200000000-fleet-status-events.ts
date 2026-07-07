import { MigrationInterface, QueryRunner } from 'typeorm';

/** Trazabilidad de cambios de `status` operativo en recursos de flota (A8). */
export class FleetStatusEvents1744200000000 implements MigrationInterface {
  name = 'FleetStatusEvents1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.fleet_status_events (
        id serial PRIMARY KEY,
        company_id integer NOT NULL,
        entity_type text NOT NULL,
        entity_id integer NOT NULL,
        previous_status text NOT NULL,
        new_status text NOT NULL,
        source text NOT NULL,
        trip_id integer NULL,
        metadata jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS fleet_status_events_entity_idx
        ON terminalops.fleet_status_events (company_id, entity_type, entity_id);

      CREATE INDEX IF NOT EXISTS fleet_status_events_created_at_idx
        ON terminalops.fleet_status_events (company_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_created_at_idx;
      DROP INDEX IF EXISTS terminalops.fleet_status_events_entity_idx;
      DROP TABLE IF EXISTS terminalops.fleet_status_events;
    `);
  }
}
