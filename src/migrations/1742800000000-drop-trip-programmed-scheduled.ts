import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTripProgrammedScheduled1742800000000 implements MigrationInterface {
  name = 'DropTripProgrammedScheduled1742800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.trips_scheduled_at_idx;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS programmed_at,
        DROP COLUMN IF EXISTS scheduled_at;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS programmed_at timestamptz,
        ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
    `);
    await queryRunner.query(`
      UPDATE terminalops.trips
      SET
        programmed_at = COALESCE(created_at, planned_departure_at, NOW()),
        scheduled_at = COALESCE(planned_departure_at, created_at, NOW())
      WHERE programmed_at IS NULL OR scheduled_at IS NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ALTER COLUMN programmed_at SET NOT NULL,
        ALTER COLUMN scheduled_at SET NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS trips_scheduled_at_idx ON terminalops.trips (scheduled_at);
    `);
  }
}
