import { Injectable } from '@nestjs/common';
import { assertFleetResourceActive } from 'src/fleet/fleet-resource-active.util';

/** Guards de elegibilidad de recursos de flota (asignación / visibilidad). */
@Injectable()
export class FleetResourceGuardService {
  assertResourceActive(
    isActive: boolean | undefined,
    resourceLabel: string,
  ): void {
    assertFleetResourceActive(isActive, resourceLabel);
  }
}
