import { MigrationInterface, QueryRunner } from 'typeorm';

export class TripUnitOdometerCredited1744300000000 implements MigrationInterface {
  name = 'TripUnitOdometerCredited1744300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS unit_odometer_km_credited numeric(12,2) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS unit_odometer_km_credited;
    `);
  }
}
