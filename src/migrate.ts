import dataSource from '../config/migration.config';

async function main() {
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
