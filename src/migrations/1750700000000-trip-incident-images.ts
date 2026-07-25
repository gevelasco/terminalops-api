import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Imágenes adjuntas a entradas de bitácora (`trip_incidents`).
 */
export class TripIncidentImages1750700000000 implements MigrationInterface {
  name = 'TripIncidentImages1750700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.trip_incident_images (
        id serial PRIMARY KEY,
        trip_incident_id integer NOT NULL
          REFERENCES terminalops.trip_incidents(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        storage_key text NULL,
        content_type text NULL,
        size_bytes bigint NULL,
        sort_order smallint NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_incident_images_incident_id_idx
        ON terminalops.trip_incident_images (trip_incident_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trip_incident_images_storage_key_idx
        ON terminalops.trip_incident_images (storage_key)
        WHERE storage_key IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trip_incident_images_storage_key_idx;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trip_incident_images_incident_id_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.trip_incident_images;
    `);
  }
}
