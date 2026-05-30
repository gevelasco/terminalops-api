import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripOperationalDistanceKm1741200000000 implements MigrationInterface {
  name = 'TripOperationalDistanceKm1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS operational_distance_km numeric(10, 2),
        ADD COLUMN IF NOT EXISTS is_round_trip boolean NOT NULL DEFAULT true;
    `);

    await queryRunner.query(`
      UPDATE terminalops.trips
      SET
        operational_distance_km = route_distance_km::numeric * 2,
        is_round_trip = true
      WHERE route_distance_km IS NOT NULL
        AND operational_distance_km IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS operational_distance_km,
        DROP COLUMN IF EXISTS is_round_trip;
    `);
  }
}
