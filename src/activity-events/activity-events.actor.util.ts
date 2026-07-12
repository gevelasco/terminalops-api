import type AuthUser from 'src/types/auth-user.type';

export function activityActorFromUser(user?: AuthUser | null): {
  actorUserId: number | null;
  actorLabel: string;
} {
  if (!user) {
    return { actorUserId: null, actorLabel: 'Sistema' };
  }
  const actorUserId = Number(user.id);
  const label =
    user.username?.trim() ||
    user.name?.trim() ||
    user.email?.trim() ||
    'Usuario';
  return {
    actorUserId: Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null,
    actorLabel: label,
  };
}
