import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Elimina fleet_status_events: nunca tuvo entity ni writers.
 * El status operativo vive en units/operators/equipment.status.
 */
export class DropFleetStatusEvents1748700000000 implements MigrationInterface {
  name = 'DropFleetStatusEvents1748700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_created_at_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.fleet_status_events_entity_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.fleet_status_events;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_status_events_entity_idx
        ON terminalops.fleet_status_events (company_id, entity_type, entity_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS fleet_status_events_created_at_idx
        ON terminalops.fleet_status_events (company_id, created_at DESC);
    `);
  }
}
