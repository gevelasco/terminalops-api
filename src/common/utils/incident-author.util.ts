import type { AppUser } from 'src/users/entities/app-user.entity';
import type { Operator } from 'src/operators/entities/operator.entity';

const ROLE_JOB_TITLES: Record<string, string> = {
  superadmin: 'Super administrador',
  admin: 'Administrador',
  coordinator: 'Coordinador de operaciones',
  operator: 'Operador',
  viewer: 'Consulta',
};

export type IncidentAuthorLookup = {
  usersByUsername: ReadonlyMap<string, { displayName: string; jobTitle: string }>;
  operatorsByPortalUsername: ReadonlyMap<string, { name: string }>;
};

function userJobTitle(user: Pick<AppUser, 'jobTitle' | 'role'>): string {
  return (
    user.jobTitle?.trim() ||
    ROLE_JOB_TITLES[user.role] ||
    ROLE_JOB_TITLES.coordinator
  );
}

export function buildIncidentAuthorLookup(
  users: readonly Pick<AppUser, 'username' | 'displayName' | 'jobTitle' | 'role'>[],
  operators: readonly Pick<Operator, 'name' | 'portalUsername'>[],
): IncidentAuthorLookup {
  const usersByUsername = new Map<string, { displayName: string; jobTitle: string }>();
  for (const user of users) {
    const key = user.username.trim().toLowerCase();
    if (!key) {
      continue;
    }
    usersByUsername.set(key, {
      displayName: user.displayName?.trim() || user.username,
      jobTitle: userJobTitle(user),
    });
  }

  const operatorsByPortalUsername = new Map<string, { name: string }>();
  for (const op of operators) {
    const key = op.portalUsername?.trim().toLowerCase();
    if (!key) {
      continue;
    }
    operatorsByPortalUsername.set(key, { name: op.name });
  }

  return { usersByUsername, operatorsByPortalUsername };
}

export function formatIncidentAuthorLabel(
  postedBy: string,
  lookup: IncidentAuthorLookup,
): string {
  const key = postedBy.trim().toLowerCase();
  if (!key) {
    return '—';
  }
  const staff = lookup.usersByUsername.get(key);
  if (staff) {
    return `${staff.displayName} · ${staff.jobTitle}`;
  }
  const op = lookup.operatorsByPortalUsername.get(key);
  if (op) {
    return `${op.name} · Operador`;
  }
  return postedBy.trim();
}
