import type { AppUser } from 'src/users/entities/app-user.entity';
import { formatPersonShortName } from 'src/common/utils/person-short-name.util';

const ROLE_JOB_TITLES: Record<string, string> = {
  superadmin: 'Super administrador',
  admin: 'Administrador',
  coordinator: 'Coordinador de operaciones',
  operator: 'Operador',
  viewer: 'Consulta',
};

export type IncidentAuthorLookup = {
  usersByUsername: ReadonlyMap<string, { displayName: string; jobTitle: string }>;
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

  return { usersByUsername };
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
    const shortName = formatPersonShortName(staff.displayName) || staff.displayName;
    return `${shortName} · ${staff.jobTitle}`;
  }
  return postedBy.trim();
}
