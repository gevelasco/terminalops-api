/**
 * client_delivery: PK serial `id` + `sort_order` (varios destinos por cliente).
 * Idempotente: cubre Railway cuando migrations_list no aplica el DDL.
 */
export async function ensureClientDeliveryMultipleSchema(
  query: (sql: string) => Promise<unknown>,
): Promise<void> {
  await query(`
    ALTER TABLE terminalops.client_delivery
      ADD COLUMN IF NOT EXISTS id integer
  `);

  await query(`
    CREATE SEQUENCE IF NOT EXISTS terminalops.client_delivery_id_seq
  `);

  await query(`
    UPDATE terminalops.client_delivery
    SET id = nextval('terminalops.client_delivery_id_seq')
    WHERE id IS NULL
  `);

  await query(`
    ALTER TABLE terminalops.client_delivery
      ALTER COLUMN id SET DEFAULT nextval('terminalops.client_delivery_id_seq')
  `);

  await query(`
    ALTER SEQUENCE terminalops.client_delivery_id_seq
      OWNED BY terminalops.client_delivery.id
  `);

  await query(`
    SELECT setval(
      'terminalops.client_delivery_id_seq',
      GREATEST(
        1,
        COALESCE((SELECT MAX(id) FROM terminalops.client_delivery), 1)
      )
    )
  `);

  await query(`
    ALTER TABLE terminalops.client_delivery
      ALTER COLUMN id SET NOT NULL
  `);

  await query(`
    DO $$
    DECLARE
      pk_name text;
    BEGIN
      SELECT c.conname INTO pk_name
      FROM pg_constraint c
      WHERE c.conrelid = 'terminalops.client_delivery'::regclass
        AND c.contype = 'p'
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(c.conkey) AS k(attnum)
          JOIN pg_attribute a
            ON a.attrelid = c.conrelid AND a.attnum = k.attnum
          WHERE a.attname = 'id'
        );
      IF pk_name IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE terminalops.client_delivery DROP CONSTRAINT %I',
          pk_name
        );
      END IF;
    END $$
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'terminalops.client_delivery'::regclass
          AND contype = 'p'
      ) THEN
        ALTER TABLE terminalops.client_delivery
          ADD CONSTRAINT client_delivery_pkey PRIMARY KEY (id);
      END IF;
    END $$
  `);

  await query(`
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
    END $$
  `);

  await query(`
    ALTER TABLE terminalops.client_delivery
      ADD COLUMN IF NOT EXISTS sort_order smallint NOT NULL DEFAULT 0
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS client_delivery_client_id_idx
      ON terminalops.client_delivery (client_id, sort_order, id)
  `);
}
