import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PRD drift: `175329` ya pudo aplicarse sin `destination_rate_prices.axle_count`
 * (migración `175299` nunca corrida en ese historial).
 */
export class DeploySchemaReconcileAxleCount1753300000000
  implements MigrationInterface
{
  name = 'DeploySchemaReconcileAxleCount1753300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rate_prices
        ADD COLUMN IF NOT EXISTS axle_count smallint NULL;

      UPDATE terminalops.destination_rate_prices
      SET axle_count = 5
      WHERE axle_count IS NULL;

      ALTER TABLE terminalops.destination_rate_prices
        DROP CONSTRAINT IF EXISTS chk_destination_rate_prices_axle_count;

      ALTER TABLE terminalops.destination_rate_prices
        ADD CONSTRAINT chk_destination_rate_prices_axle_count
        CHECK (
          axle_count IS NULL
          OR (axle_count >= 2 AND axle_count <= 12)
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.destination_rate_prices
        DROP CONSTRAINT IF EXISTS chk_destination_rate_prices_axle_count;

      ALTER TABLE terminalops.destination_rate_prices
        DROP COLUMN IF EXISTS axle_count;
    `);
  }
}