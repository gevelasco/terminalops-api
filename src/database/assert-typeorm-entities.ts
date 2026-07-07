import { INestApplication } from '@nestjs/common';
import { DataSource, EntityTarget } from 'typeorm';
import { AppUser } from 'src/users/entities/app-user.entity';
import { Company } from 'src/companies/entities/company.entity';

const REQUIRED_ENTITIES: EntityTarget<unknown>[] = [AppUser, Company];

/**
 * Fail fast at boot when TypeORM metadata is missing.
 * Prevents serving traffic with a half-initialized DataSource (e.g. stale build).
 */
export function assertRequiredTypeOrmEntities(app: INestApplication): void {
  const dataSource = app.get(DataSource);
  const missing = REQUIRED_ENTITIES.map((entity) => {
    const ctor = entity as { name?: string };
    return ctor.name ?? String(entity);
  }).filter((name, index) => !dataSource.hasMetadata(REQUIRED_ENTITIES[index]));

  if (missing.length === 0) {
    return;
  }

  throw new Error(
    `TypeORM metadata missing for: ${missing.join(', ')}. ` +
      'Rebuild the API (`npm run build`) and restart the process. ' +
      'In Docker, redeploy the image so dist/ matches the running container.',
  );
}
