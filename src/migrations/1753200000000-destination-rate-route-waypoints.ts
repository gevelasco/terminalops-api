import { MigrationInterface, QueryRunner } from 'typeorm';

export class DestinationRateRouteWaypoints1753200000000
  implements MigrationInterface
{
  name = 'DestinationRateRouteWaypoints1753200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        ADD COLUMN IF NOT EXISTS route_waypoints JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rates
        DROP COLUMN IF EXISTS route_waypoints;
    `);
  }
}