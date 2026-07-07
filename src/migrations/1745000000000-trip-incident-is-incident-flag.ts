import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripIncidentIsIncidentFlag1745000000000 implements MigrationInterface {
  name = 'TripIncidentIsIncidentFlag1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        ADD COLUMN IF NOT EXISTS is_incident boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      UPDATE terminalops.trip_incidents
      SET is_incident = true
      WHERE is_incident = false;
    `);

    await queryRunner.query(`
      UPDATE terminalops.trips t
      SET
        has_incident = EXISTS (
          SELECT 1
          FROM terminalops.trip_incidents i
          WHERE i.trip_id = t.id AND i.is_incident = true
        ),
        open_incident_count = COALESCE((
          SELECT COUNT(*)::int
          FROM terminalops.trip_incidents i
          WHERE i.trip_id = t.id
            AND i.is_incident = true
            AND i.status = 'open'
        ), 0);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_incidents
        DROP COLUMN IF EXISTS is_incident;
    `);
  }
}
