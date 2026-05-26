import { hash } from 'bcrypt';

export function hashPassword(
  password: string,
  saltRounds: number,
): Promise<string> {
  return hash(password, saltRounds);
}
