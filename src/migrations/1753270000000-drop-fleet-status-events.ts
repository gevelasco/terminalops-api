import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tabla legacy sin entity ni writers; estado de flota no se persiste aquí. */
export class DropFleetStatusEvents1753270000000 implements MigrationInterface {
  name = 'DropFleetStatusEvents1753270000000';

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
        id bigserial PRIMARY KEY,
        company_id integer NOT NULL
          REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        entity_type text NOT NULL,
        entity_id integer NOT NULL,
        previous_status text NULL,
        new_status text NOT NULL,
        trip_id integer NULL
          REFERENCES terminalops.trips(id) ON DELETE SET NULL,
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