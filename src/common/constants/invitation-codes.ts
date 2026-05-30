/** Códigos de invitación válidos (hardcoded hasta tener gestión en BD). */
export const VALID_INVITATION_CODES = [
  'TX9X-GRUP-2026-1V4N',
  'VK7J-TERM-A995-S4UL',
  'NBBB-AXOL-994A-G3RM',
] as const;

export type InvitationCode = (typeof VALID_INVITATION_CODES)[number];

export function isValidInvitationCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return false;
  }
  return VALID_INVITATION_CODES.some((c) => c === normalized);
}
