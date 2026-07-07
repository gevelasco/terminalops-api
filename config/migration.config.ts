import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { typeOrmEntityGlobsFromDir } from '../src/database/typeorm-entity-globs';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  loadEnv({ path: envPath });
} else {
  loadEnv();
}

if (typeof process.env.DB_PASSWORD !== 'string' || process.env.DB_PASSWORD.length === 0) {
  throw new Error(
    'Falta DB_PASSWORD. Copia .env.example a .env:  cp .env.example .env',
  );
}

const isLocal =
  process.env.NODE_ENV === 'local' ||
  process.env.NODE_ENV === 'development' ||
  !process.env.NODE_ENV;

const entitiesRoot = path.join(process.cwd(), isLocal ? 'src' : 'dist/src');
const migrationsRoot = entitiesRoot;

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: typeOrmEntityGlobsFromDir(entitiesRoot, {
    includeTypeScript: isLocal,
  }),
  migrations: [path.join(migrationsRoot, 'migrations/*.{ts,js}')],
  migrationsTableName: 'migrations_list',
});

export default dataSource;
