import { BadRequestException } from '@nestjs/common';

export const LEGACY_SCHEDULE_FIELDS_MESSAGE =
  'Invalid contract: programmedAt and scheduledAt are not accepted';

const LEGACY_KEYS = new Set([
  'programmedAt',
  'scheduledAt',
  'programmed_at',
  'scheduled_at',
]);

export function rejectLegacyScheduleFields(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (LEGACY_KEYS.has(key)) {
      throw new BadRequestException(LEGACY_SCHEDULE_FIELDS_MESSAGE);
    }
  }
}
