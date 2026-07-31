/**
 * Helpers de códigos de invitación.
 * Los códigos viven en BD (`invitation_codes`): one-time, plan y duración configurables.
 */

/** Fallback histórico (meses) si un registro no trae license_months. */
export const DEFAULT_INVITATION_LICENSE_MONTHS = 6;

export type InvitationPurpose = 'signup' | 'upgrade';

export type InvitationGrantedPlan = 'basic' | 'standard' | 'pro';

export function normalizeInvitationCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Fecha de fin de licencia desde `from` sumando `months`. */
export function invitationLicenseEndsAt(
  months: number = DEFAULT_INVITATION_LICENSE_MONTHS,
  from: Date = new Date(),
): Date {
  const safeMonths =
    Number.isFinite(months) && months > 0
      ? Math.min(Math.floor(months), 120)
      : DEFAULT_INVITATION_LICENSE_MONTHS;
  const ends = new Date(from.getTime());
  ends.setMonth(ends.getMonth() + safeMonths);
  return ends;
}
