import { BadRequestException } from '@nestjs/common';

/** Trip `status` is lifecycle-owned — never accepted from API clients (PRD). */
export const TRIP_SYSTEM_OWNED_STATUS_FIELD = 'status' as const;

export function rejectClientTripStatusMutation(
  payload: Record<string, unknown>,
): void {
  if (
    Object.prototype.hasOwnProperty.call(
      payload,
      TRIP_SYSTEM_OWNED_STATUS_FIELD,
    )
  ) {
    throw new BadRequestException(
      'Trip status is system-owned and cannot be set via API',
    );
  }
}
