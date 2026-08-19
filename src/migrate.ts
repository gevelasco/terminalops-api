import dataSource from '../config/migration.config';

/**
 * Advisory lock global para que solo una instancia corra migraciones a la vez.
 * En un deploy con varias réplicas todas ejecutan este paso al mismo tiempo;
 * sin el lock, dos runners intentarían aplicar la misma migración y una
 * fallaría. Con el lock la segunda espera y luego no encuentra nada pendiente.
 */
const MIGRATION_LOCK_KEY = 74_027_002;

async function main() {
  await dataSource.initialize();
  try {
    // Lock bloqueante sobre la conexión: la segunda instancia espera aquí.
    await dataSource.query(`SELECT pg_advisory_lock($1)`, [MIGRATION_LOCK_KEY]);
    try {
      const executed = await dataSource.runMigrations();
      console.log(
        executed.length === 0
          ? 'Migrations: none pending'
          : `Migrations: applied ${executed.length} → ${executed
              .map((m) => m.name)
              .join(', ')}`,
      );
      // Hard ensure: unit document storage columns (covers migrations_list drift).
      await dataSource.query(`
        ALTER TABLE terminalops.unit_fleet_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.unit_fleet_documents
          ADD COLUMN IF NOT EXISTS content_type text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.unit_fleet_documents
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS unit_fleet_documents_storage_key_idx
          ON terminalops.unit_fleet_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: unit_fleet_documents storage columns OK');
      // Hard ensure: equipment document storage columns (covers migrations_list drift).
      await dataSource.query(`
        ALTER TABLE terminalops.equipment_fleet_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.equipment_fleet_documents
          ADD COLUMN IF NOT EXISTS content_type text NULL;
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.equipment_fleet_documents
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS equipment_fleet_documents_storage_key_idx
          ON terminalops.equipment_fleet_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: equipment_fleet_documents storage columns OK');
      // Hard ensure: trip documents table (covers migrations_list drift).
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.trip_documents (
          id serial PRIMARY KEY,
          trip_id integer NOT NULL REFERENCES terminalops.trips(id) ON DELETE CASCADE,
          document_kind text NOT NULL,
          file_name text NOT NULL,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL,
          sort_order smallint NOT NULL DEFAULT 0
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_documents_trip_id_idx
          ON terminalops.trip_documents (trip_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_documents_storage_key_idx
          ON terminalops.trip_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: trip_documents OK');
      // Hard ensure: empty_delivery kind on trip_documents CHECK.
      await dataSource.query(`
        ALTER TABLE terminalops.trip_documents
          DROP CONSTRAINT IF EXISTS trip_documents_kind_chk
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.trip_documents
          ADD CONSTRAINT trip_documents_kind_chk CHECK (
            document_kind IN (
              'load',
              'operational_costs',
              'billing',
              'empty_delivery'
            )
          )
      `);
      console.log('Schema ensure: trip_documents empty_delivery kind OK');
      // Hard ensure: expense documents table (covers migrations_list drift).
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.expense_documents (
          id serial PRIMARY KEY,
          expense_id integer NOT NULL
            REFERENCES terminalops.expenses(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          slot text NOT NULL CHECK (slot IN ('receipt')),
          added_at date NOT NULL,
          sort_order smallint NOT NULL DEFAULT 0,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL
        );
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.expense_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL,
          ADD COLUMN IF NOT EXISTS content_type text NULL,
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS expense_documents_expense_id_idx
          ON terminalops.expense_documents (expense_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS expense_documents_storage_key_idx
          ON terminalops.expense_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: expense_documents OK');
      // Hard ensure: client documents (covers migrations_list drift).
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.client_documents (
          id serial PRIMARY KEY,
          client_id integer NOT NULL
            REFERENCES terminalops.clients(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          slot text NOT NULL CHECK (slot IN ('fiscal')),
          added_at date NOT NULL,
          sort_order smallint NOT NULL DEFAULT 0,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL
        );
      `);
      await dataSource.query(`
        ALTER TABLE terminalops.client_documents
          ADD COLUMN IF NOT EXISTS storage_key text NULL,
          ADD COLUMN IF NOT EXISTS content_type text NULL,
          ADD COLUMN IF NOT EXISTS size_bytes bigint NULL;
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS client_documents_client_id_idx
          ON terminalops.client_documents (client_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS client_documents_storage_key_idx
          ON terminalops.client_documents (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: client_documents OK');
      // Hard ensure: checklist personal por usuario.
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.user_checklist_todos (
          id serial PRIMARY KEY,
          company_id integer NOT NULL
            REFERENCES terminalops.companies(id) ON DELETE CASCADE,
          user_id integer NOT NULL
            REFERENCES terminalops.app_user(id) ON DELETE CASCADE,
          text text NOT NULL,
          completed boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT user_checklist_todos_text_not_blank
            CHECK (btrim(text) <> '')
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS user_checklist_todos_user_company_idx
          ON terminalops.user_checklist_todos (user_id, company_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS user_checklist_todos_company_created_idx
          ON terminalops.user_checklist_todos (company_id, created_at DESC);
      `);
      console.log('Schema ensure: user_checklist_todos OK');
      // Hard ensure: invitation codes one-time.
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.invitation_codes (
          id serial PRIMARY KEY,
          code text NOT NULL,
          purpose text NOT NULL,
          granted_plan text NOT NULL,
          license_months integer NOT NULL,
          max_uses integer NOT NULL DEFAULT 1,
          used_count integer NOT NULL DEFAULT 0,
          is_active boolean NOT NULL DEFAULT true,
          expires_at timestamptz NULL,
          redeemed_at timestamptz NULL,
          redeemed_by_user_id integer NULL
            REFERENCES terminalops.app_user(id) ON DELETE SET NULL,
          redeemed_by_company_id integer NULL
            REFERENCES terminalops.companies(id) ON DELETE SET NULL,
          note text NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT invitation_codes_code_uidx UNIQUE (code),
          CONSTRAINT invitation_codes_purpose_chk
            CHECK (purpose IN ('signup', 'upgrade')),
          CONSTRAINT invitation_codes_plan_chk
            CHECK (granted_plan IN ('basic', 'standard', 'pro')),
          CONSTRAINT invitation_codes_license_months_chk
            CHECK (license_months >= 1 AND license_months <= 120),
          CONSTRAINT invitation_codes_max_uses_chk
            CHECK (max_uses >= 1),
          CONSTRAINT invitation_codes_used_count_chk
            CHECK (used_count >= 0 AND used_count <= max_uses)
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS invitation_codes_available_idx
          ON terminalops.invitation_codes (purpose, is_active)
          WHERE used_count < max_uses AND is_active = true;
      `);
      await dataSource.query(`
        INSERT INTO terminalops.invitation_codes
          (code, purpose, granted_plan, license_months, max_uses, note)
        VALUES
          ('TX9X-BASI-2026-1V4N', 'signup', 'basic', 6, 1, 'Beta alta #1'),
          ('VK7J-BASI-A995-S4UL', 'signup', 'basic', 6, 1, 'Beta alta #2'),
          ('NBBB-BASI-994A-G3RM', 'signup', 'basic', 6, 1, 'Beta alta #3'),
          ('PX8M-PROX-2026-K4QJ', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #1'),
          ('W3HN-PROX-B771-M9VR', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #2'),
          ('JC5T-PROX-2026-L2XW', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #3')
        ON CONFLICT (code) DO NOTHING;
      `);
      console.log('Schema ensure: invitation_codes OK');
      // Hard ensure: bitácora incident images table.
      await dataSource.query(`
        CREATE TABLE IF NOT EXISTS terminalops.trip_incident_images (
          id serial PRIMARY KEY,
          trip_incident_id integer NOT NULL
            REFERENCES terminalops.trip_incidents(id) ON DELETE CASCADE,
          file_name text NOT NULL,
          storage_key text NULL,
          content_type text NULL,
          size_bytes bigint NULL,
          sort_order smallint NOT NULL DEFAULT 0
        );
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_incident_images_incident_id_idx
          ON terminalops.trip_incident_images (trip_incident_id);
      `);
      await dataSource.query(`
        CREATE INDEX IF NOT EXISTS trip_incident_images_storage_key_idx
          ON terminalops.trip_incident_images (storage_key)
          WHERE storage_key IS NOT NULL;
      `);
      console.log('Schema ensure: trip_incident_images OK');
    } finally {
      await dataSource.query(`SELECT pg_advisory_unlock($1)`, [
        MIGRATION_LOCK_KEY,
      ]);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
