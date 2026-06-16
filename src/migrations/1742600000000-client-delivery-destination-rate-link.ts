import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientDeliveryDestinationRateLink1742600000000
  implements MigrationInterface
{
  name = 'ClientDeliveryDestinationRateLink1742600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.client_delivery
  ADD COLUMN IF NOT EXISTS destination_rate_id INT NULL,
  ADD COLUMN IF NOT EXISTS is_unpriced_route BOOLEAN NOT NULL DEFAULT FALSE;
`);

    await queryRunner.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_client_delivery_destination_rate'
  ) THEN
    ALTER TABLE terminalops.client_delivery
      ADD CONSTRAINT fk_client_delivery_destination_rate
      FOREIGN KEY (destination_rate_id)
      REFERENCES terminalops.destination_rates(id)
      ON DELETE SET NULL;
  END IF;
END $$;
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE terminalops.client_delivery
  DROP CONSTRAINT IF EXISTS fk_client_delivery_destination_rate;
`);

    await queryRunner.query(`
ALTER TABLE terminalops.client_delivery
  DROP COLUMN IF EXISTS destination_rate_id,
  DROP COLUMN IF EXISTS is_unpriced_route;
`);
  }
}
