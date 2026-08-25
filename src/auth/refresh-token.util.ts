import { createHash, timingSafeEqual } from 'crypto';

export const REFRESH_TOKEN_TTL = '7d';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Dos pestañas con el mismo token pueden rotar a la vez; no matar la familia. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

export type RefreshJwtPayload = {
  userId: number;
  jti: string;
};

export type RefreshReuseDecision = 'active' | 'grace' | 'reuse';

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenHashMatches(
  storedHash: string,
  candidateHash: string,
): boolean {
  const stored = Buffer.from(storedHash);
  const candidate = Buffer.from(candidateHash);
  if (stored.length !== candidate.length) {
    return false;
  }
  return timingSafeEqual(stored, candidate);
}

export function parseRefreshJwtPayload(payload: unknown): RefreshJwtPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const raw = payload as { sub?: unknown; jti?: unknown };
  const userId = Number(raw.sub);
  const jti = typeof raw.jti === 'string' ? raw.jti.trim() : '';
  if (!Number.isInteger(userId) || userId <= 0 || !jti) {
    return null;
  }
  return { userId, jti };
}

export function refreshReuseDecision(
  revokedAt: Date | null | undefined,
  now: Date = new Date(),
  graceMs: number = REFRESH_REUSE_GRACE_MS,
): RefreshReuseDecision {
  if (!revokedAt) {
    return 'active';
  }
  if (now.getTime() - revokedAt.getTime() <= graceMs) {
    return 'grace';
  }
  return 'reuse';
}
