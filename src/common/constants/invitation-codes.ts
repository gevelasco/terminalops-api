/** Códigos de invitación válidos (hardcoded hasta tener gestión en BD). */
export const VALID_INVITATION_CODES = [
  'VSC-GRUPO-2026-A',
  'VSC-GRUPO-2026-B',
  'TERMINAL-INV-001',
  'TERMINAL-INV-002',
  'AXOLOTL-ACCESS',
] as const;

export type InvitationCode = (typeof VALID_INVITATION_CODES)[number];

export function isValidInvitationCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return false;
  }
  return VALID_INVITATION_CODES.some((c) => c === normalized);
}
