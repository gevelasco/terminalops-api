import { BadRequestException } from '@nestjs/common';
import { assertFleetResourceActive } from './fleet-resource-active.util';

/** Recurso elegible para asignación a maniobra (activo y no en mantenimiento). */
export function assertFleetResourceAssignableForTrip(
  resource: { isActive?: boolean; status?: string | null },
  resourceLabel: string,
): void {
  assertFleetResourceActive(resource.isActive, resourceLabel);
  const normalized = (resource.status ?? '').trim().toLowerCase();
  if (normalized === 'maintenance') {
    throw new BadRequestException(
      `${resourceLabel} is in maintenance and cannot be assigned to a trip`,
    );
  }
}
