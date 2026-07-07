import { join } from 'path';

type EntityGlobOptions = {
  /** Local tooling (TypeORM CLI / ts-node) reads `.ts` sources. */
  includeTypeScript?: boolean;
};

/**
 * Entity glob rooted at a known directory.
 * Runtime Nest always passes `__dirname` from `dist/src` (compiled output).
 */
export function typeOrmEntityGlobsFromDir(
  baseDir: string,
  options: EntityGlobOptions = {},
): string[] {
  const pattern = options.includeTypeScript
    ? '*.entity.{ts,js}'
    : '*.entity.js';
  return [join(baseDir, '**', pattern)];
}
