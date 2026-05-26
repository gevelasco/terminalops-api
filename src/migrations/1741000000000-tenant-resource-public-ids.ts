import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'operators',
  'operator_documents',
  'clients',
  'client_contacts',
  'units',
  'equipment',
  'trips',
  'expenses',
  'trip_incidents',
] as const;

export class TenantResourcePublicIds1741000000000 implements MigrationInterface {
  name = 'TenantResourcePublicIds1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      const seq = `terminalops.${table}_public_id_seq`;
      await queryRunner.query(`
        ALTER TABLE terminalops.${table}
        ADD COLUMN IF NOT EXISTS public_id integer;

        CREATE SEQUENCE IF NOT EXISTS ${seq};

        UPDATE terminalops.${table}
        SET public_id = nextval('${seq}')
        WHERE public_id IS NULL;

        ALTER TABLE terminalops.${table}
        ALTER COLUMN public_id SET NOT NULL;

        ALTER TABLE terminalops.${table}
        ADD CONSTRAINT ${table}_public_id_uniq UNIQUE (public_id);

        ALTER TABLE terminalops.${table}
        ALTER COLUMN public_id SET DEFAULT nextval('${seq}');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...TABLES].reverse()) {
      const seq = `terminalops.${table}_public_id_seq`;
      await queryRunner.query(`
        ALTER TABLE terminalops.${table} DROP CONSTRAINT IF EXISTS ${table}_public_id_uniq;
        ALTER TABLE terminalops.${table} DROP COLUMN IF EXISTS public_id;
        DROP SEQUENCE IF EXISTS ${seq};
      `);
    }
  }
}
