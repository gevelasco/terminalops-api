import { isAppUserLoginAllowed } from './auth-login.util';

describe('auth-login.util', () => {
  it('allows only active users to login', () => {
    expect(isAppUserLoginAllowed('active')).toBe(true);
    expect(isAppUserLoginAllowed('ACTIVE')).toBe(true);
  });

  it('blocks disabled and pending users', () => {
    expect(isAppUserLoginAllowed('disabled')).toBe(false);
    expect(isAppUserLoginAllowed('pending')).toBe(false);
    expect(isAppUserLoginAllowed(null)).toBe(false);
  });
});
