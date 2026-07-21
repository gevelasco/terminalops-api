import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clients hygiene:
 * - drop commercial_health (salud comercial se calcula desde trips)
 * - drop is_unpriced_route (derivable: destino sin destination_rate_id)
 */
export class CleanupClientRedundantFlags1749200000000
  implements MigrationInterface
{
  name = 'CleanupClientRedundantFlags1749200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.client_payment_terms
        DROP COLUMN IF EXISTS commercial_health;
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        DROP COLUMN IF EXISTS is_unpriced_route;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.client_payment_terms
        ADD COLUMN IF NOT EXISTS commercial_health text NOT NULL DEFAULT 'not_evaluated'
          CHECK (commercial_health IN (
            'not_evaluated',
            'good_standing',
            'watch_list',
            'restricted'
          ));
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        ADD COLUMN IF NOT EXISTS is_unpriced_route boolean NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      UPDATE terminalops.client_delivery
      SET is_unpriced_route = TRUE
      WHERE postal_code IS NOT NULL
        AND BTRIM(postal_code) <> ''
        AND locality IS NOT NULL
        AND BTRIM(locality) <> ''
        AND destination_rate_id IS NULL;
    `);
  }
}
