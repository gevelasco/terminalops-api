import { join } from 'path';

/**
 * Migration globs rooted at `dist/src` (prod) or `src` (local TypeORM CLI).
 * Avoid brace patterns like `*.{ts,js}` — empty match if brace expansion is off.
 */
export function typeOrmMigrationGlobsFromDir(
  baseDir: string,
  options: { includeTypeScript?: boolean } = {},
): string[] {
  const migrationsDir = join(baseDir, 'migrations');
  if (options.includeTypeScript) {
    return [join(migrationsDir, '*.ts')];
  }
  return [join(migrationsDir, '*.js')];
}
