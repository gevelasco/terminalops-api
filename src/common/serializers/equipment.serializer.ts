import { Equipment } from 'src/equipment/entities/equipment.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeEquipment(
  equipment: Equipment,
  companyPublicId: number,
  unitPublicId?: number | null,
): Record<string, unknown> {
  const resolvedUnitPublicId =
    unitPublicId ?? equipment.unit?.publicId ?? null;
  return {
    id: equipment.publicId,
    companyId: companyPublicId,
    unitId: resolvedUnitPublicId,
    name: equipment.name,
    serialNumber: equipment.serialNumber,
    lastServiceDate: equipment.lastServiceDate ?? undefined,
    plate: equipment.plate ?? undefined,
    type: equipment.type ?? undefined,
    status: equipment.status ?? undefined,
    fleetProfile: equipment.fleetProfile ?? undefined,
    createdAt: toIsoString(equipment.createdAt),
    updatedAt: toIsoString(equipment.updatedAt),
  };
}
