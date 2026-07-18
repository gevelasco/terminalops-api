import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Maniobras: registro de entrega de vacío (fecha/hora y lugar). El lugar
 * reutiliza el catálogo por empresa trip_load_places.
 */
export class TripEmptyDelivery1748100000000 implements MigrationInterface {
  name = 'TripEmptyDelivery1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        ADD COLUMN IF NOT EXISTS empty_delivery_at timestamptz NULL,
        ADD COLUMN IF NOT EXISTS empty_delivery_place text NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trips
        DROP COLUMN IF EXISTS empty_delivery_at,
        DROP COLUMN IF EXISTS empty_delivery_place;
    `);
  }
}
