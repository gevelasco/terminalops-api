import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnitApproximatePerformanceKmL1752510000000
  implements MigrationInterface
{
  name = 'UnitApproximatePerformanceKmL1752510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS approximate_performance_km_l numeric(8,2) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS approximate_performance_km_l;
    `);
  }
}
