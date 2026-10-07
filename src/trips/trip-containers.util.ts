import type { TripContainerSlotDto } from './dto/trip-container-slot.dto';
import {
  isValidTripContainerNumber,
  normalizeTripContainerNumber,
  normalizeTripCargoCategory,
} from './trip-cargo-category.util';

export type NormalizedTripContainerSlot = {
  slot: number;
  containerType: string;
  containerNumber?: string;
};

export function isTripContainerSlotEmpty(slot: {
  containerType?: string | null;
  containerNumber?: string | null;
}): boolean {
  const type = String(slot.containerType ?? 'na').trim().toLowerCase() || 'na';
  const num = normalizeTripContainerNumber(slot.containerNumber);
  return type === 'na' && !num;
}

/** Máximo de slots según configuración operativa. */
export function maxContainerSlotsForOperation(operationCode: string): number {
  const code = operationCode.trim().toLowerCase();
  if (code === 'full' || code === 'doble-articulado' || code === 'doble_articulado') {
    return 2;
  }
  return 1;
}

export function resolveTripContainersForCreate(input: {
  cargoCategory?: string | null;
  operationType: string;
  containerType?: string | null;
  containerNumber?: string | null;
  containers?: TripContainerSlotDto[] | null;
}): NormalizedTripContainerSlot[] {
  const cargoCategory = normalizeTripCargoCategory(input.cargoCategory);
  if (cargoCategory !== 'contenedor') {
    return [];
  }

  const maxSlots = maxContainerSlotsForOperation(input.operationType);
  const rawSlots: TripContainerSlotDto[] = input.containers?.length
    ? input.containers
    : [
        {
          slot: 1,
          containerType: String(input.containerType ?? 'na'),
          containerNumber: input.containerNumber ?? undefined,
        },
      ];

  const bySlot = new Map<number, NormalizedTripContainerSlot>();

  for (let i = 0; i < rawSlots.length; i++) {
    const row = rawSlots[i]!;
    const slot = row.slot ?? i + 1;
    if (slot < 1 || slot > maxSlots) {
      throw new Error('INVALID_CONTAINER_SLOT');
    }
    const containerType = String(row.containerType ?? 'na').trim() || 'na';
    const containerNumber = normalizeTripContainerNumber(row.containerNumber);
    if (containerNumber && !isValidTripContainerNumber(containerNumber)) {
      throw new Error('INVALID_CONTAINER_NUMBER');
    }
    if (isTripContainerSlotEmpty({ containerType, containerNumber })) {
      continue;
    }
    bySlot.set(slot, { slot, containerType, containerNumber });
  }

  return [...bySlot.values()].sort((a, b) => a.slot - b.slot);
}

export function primaryContainerFromSlots(
  slots: readonly NormalizedTripContainerSlot[],
): { containerType: string; containerNumber?: string } {
  const primary = slots.find((s) => s.slot === 1) ?? slots[0];
  if (!primary) {
    return { containerType: 'na', containerNumber: undefined };
  }
  return {
    containerType: primary.containerType,
    containerNumber: primary.containerNumber,
  };
}
