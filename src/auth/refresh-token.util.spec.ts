import {
  hashRefreshToken,
  parseRefreshJwtPayload,
  refreshReuseDecision,
  refreshTokenHashMatches,
} from './refresh-token.util';

describe('refresh-token.util', () => {
  it('hashes the same token consistently', () => {
    const hash = hashRefreshToken('abc');
    expect(hash).toHaveLength(64);
    expect(hashRefreshToken('abc')).toBe(hash);
    expect(hashRefreshToken('abd')).not.toBe(hash);
  });

  it('compares hashes in constant time', () => {
    const hash = hashRefreshToken('token');
    expect(refreshTokenHashMatches(hash, hash)).toBe(true);
    expect(refreshTokenHashMatches(hash, hashRefreshToken('other'))).toBe(false);
  });

  it('requires jti and a numeric user id', () => {
    expect(parseRefreshJwtPayload({ sub: 9, jti: 'j-1' })).toEqual({
      userId: 9,
      jti: 'j-1',
    });
    expect(parseRefreshJwtPayload({ sub: '9' })).toBeNull();
    expect(parseRefreshJwtPayload({ sub: 9, jti: '  ' })).toBeNull();
  });

  it('treats a freshly rotated token as grace, not theft', () => {
    const now = new Date('2026-08-21T12:00:00.000Z');
    const justRevoked = new Date('2026-08-21T11:59:45.000Z');
    const oldRevoked = new Date('2026-08-21T11:50:00.000Z');
    expect(refreshReuseDecision(null, now)).toBe('active');
    expect(refreshReuseDecision(justRevoked, now)).toBe('grace');
    expect(refreshReuseDecision(oldRevoked, now)).toBe('reuse');
  });
});
