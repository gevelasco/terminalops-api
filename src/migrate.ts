import dataSource from '../config/migration.config';

async function main() {
  await dataSource.initialize();
  const executed = await dataSource.runMigrations();
  console.log(
    executed.length === 0
      ? 'Migrations: none pending'
      : `Migrations: applied ${executed.length} → ${executed.map((m) => m.name).join(', ')}`,
  );
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
