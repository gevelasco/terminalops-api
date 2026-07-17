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
