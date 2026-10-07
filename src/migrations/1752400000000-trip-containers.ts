import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contenedores por maniobra (1..n). El listado sigue usando trips.container_type
 * (espejo del slot 1); el detalle carga trip_containers con una query aparte.
 */
export class TripContainers1752400000000 implements MigrationInterface {
  name = 'TripContainers1752400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.trip_containers (
        id serial PRIMARY KEY,
        trip_id integer NOT NULL
          REFERENCES terminalops.trips(id) ON DELETE CASCADE,
        slot smallint NOT NULL CHECK (slot >= 1 AND slot <= 8),
        container_type text NOT NULL DEFAULT 'na',
        container_number text NULL,
        CONSTRAINT trip_containers_trip_slot_unique UNIQUE (trip_id, slot)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_containers_trip_id_idx
        ON terminalops.trip_containers (trip_id);
    `);

    await queryRunner.query(`
      INSERT INTO terminalops.trip_containers (trip_id, slot, container_type, container_number)
      SELECT
        t.id,
        1,
        COALESCE(NULLIF(TRIM(t.container_type), ''), 'na'),
        NULLIF(TRIM(t.container_number), '')
      FROM terminalops.trips t
      WHERE NOT EXISTS (
        SELECT 1 FROM terminalops.trip_containers tc WHERE tc.trip_id = t.id AND tc.slot = 1
      )
        AND (
          COALESCE(NULLIF(TRIM(t.container_type), ''), 'na') <> 'na'
          OR NULLIF(TRIM(t.container_number), '') IS NOT NULL
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_containers;
    `);
  }
}
