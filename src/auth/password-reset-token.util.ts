export const PASSWORD_RESET_PURPOSE = 'password_reset' as const;

export type PasswordResetJwtPayload = {
  purpose: typeof PASSWORD_RESET_PURPOSE;
  sub: number;
  email: string;
};

export function buildPasswordResetPayload(
  userId: number,
  email: string,
): PasswordResetJwtPayload {
  return {
    purpose: PASSWORD_RESET_PURPOSE,
    sub: userId,
    email: email.trim().toLowerCase(),
  };
}

export function isPasswordResetPayload(
  payload: unknown,
): payload is PasswordResetJwtPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const p = payload as PasswordResetJwtPayload;
  return (
    p.purpose === PASSWORD_RESET_PURPOSE &&
    Number.isFinite(p.sub) &&
    p.sub > 0 &&
    typeof p.email === 'string' &&
    p.email.trim().length > 0
  );
}
