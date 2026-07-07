import { BadRequestException } from '@nestjs/common';

/** Recurso de flota visible y asignable (`is_active !== false`). */
export function assertFleetResourceActive(
  isActive: boolean | undefined,
  resourceLabel: string,
): void {
  if (isActive === false) {
    throw new BadRequestException(
      `${resourceLabel} is inactive and cannot be assigned`,
    );
  }
}

export function isFleetResourceActive(isActive: boolean | undefined): boolean {
  return isActive !== false;
}
