import { MigrationInterface, QueryRunner } from 'typeorm';
import { ensureClientDeliveryMultipleSchema } from '../database/ensure-client-delivery-multiple';

/**
 * Un cliente puede tener varios lugares de entrega (plantas / CPs).
 * `client_id` deja de ser PK; se añade `id` serial y `sort_order`.
 */
export class ClientDeliveryMultiple1752100000000 implements MigrationInterface {
  name = 'ClientDeliveryMultiple1752100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await ensureClientDeliveryMultipleSchema((sql) => queryRunner.query(sql));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM terminalops.client_delivery a
      USING terminalops.client_delivery b
      WHERE a.client_id = b.client_id
        AND a.id > b.id;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.client_delivery_client_id_idx;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        DROP CONSTRAINT IF EXISTS client_delivery_pkey;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        DROP COLUMN IF EXISTS id;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        DROP COLUMN IF EXISTS sort_order;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        ADD CONSTRAINT client_delivery_pkey PRIMARY KEY (client_id);
    `);
  }
}
