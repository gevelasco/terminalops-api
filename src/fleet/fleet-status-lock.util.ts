import { BadRequestException } from '@nestjs/common';

/**
 * A5 — `status` is NOT a domain input. It is derived state persisted by
 * internal engines only (trip lifecycle sync, unit maintenance workflow).
 */
export const FLEET_SYSTEM_OWNED_STATUS_FIELD = 'status' as const;

/** Rechaza mutación manual de `status` (campo system-owned). */
export function rejectClientFleetStatusMutation(
  payload: Record<string, unknown>,
): void {
  if (Object.prototype.hasOwnProperty.call(payload, FLEET_SYSTEM_OWNED_STATUS_FIELD)) {
    throw new BadRequestException(
      'status is system-owned and cannot be set via API',
    );
  }
}
