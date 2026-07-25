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
