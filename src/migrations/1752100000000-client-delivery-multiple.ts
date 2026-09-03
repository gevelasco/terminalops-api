import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Un cliente puede tener varios lugares de entrega (plantas / CPs).
 * `client_id` deja de ser PK; se añade `id` serial y `sort_order`.
 */
export class ClientDeliveryMultiple1752100000000 implements MigrationInterface {
  name = 'ClientDeliveryMultiple1752100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        pk_name text;
      BEGIN
        SELECT conname INTO pk_name
        FROM pg_constraint
        WHERE conrelid = 'terminalops.client_delivery'::regclass
          AND contype = 'p';
        IF pk_name IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE terminalops.client_delivery DROP CONSTRAINT %I',
            pk_name
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        ADD COLUMN IF NOT EXISTS id integer;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'S'
            AND n.nspname = 'terminalops'
            AND c.relname = 'client_delivery_id_seq'
        ) THEN
          CREATE SEQUENCE terminalops.client_delivery_id_seq;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      UPDATE terminalops.client_delivery
      SET id = nextval('terminalops.client_delivery_id_seq')
      WHERE id IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        ALTER COLUMN id SET DEFAULT nextval('terminalops.client_delivery_id_seq');
    `);

    await queryRunner.query(`
      ALTER SEQUENCE terminalops.client_delivery_id_seq
        OWNED BY terminalops.client_delivery.id;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        ALTER COLUMN id SET NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        ADD CONSTRAINT client_delivery_pkey PRIMARY KEY (id);
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'client_delivery_client_id_fkey'
        ) THEN
          ALTER TABLE terminalops.client_delivery
            ADD CONSTRAINT client_delivery_client_id_fkey
            FOREIGN KEY (client_id)
            REFERENCES terminalops.clients(id)
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.client_delivery
        ADD COLUMN IF NOT EXISTS sort_order smallint NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS client_delivery_client_id_idx
        ON terminalops.client_delivery (client_id, sort_order, id);
    `);
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
