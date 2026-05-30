import { Equipment } from 'src/equipment/entities/equipment.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';
import { profileToFleetMeta } from 'src/equipment/mappers/equipment-fleet-meta.mapper';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';

export type SerializeEquipmentOptions = {
  unitId?: number | null;
  tenure?: FleetAssetTenure | null;
};

export function serializeEquipment(
  equipment: Equipment,
  options?: SerializeEquipmentOptions,
): Record<string, unknown> {
  const resolvedUnitId =
    options?.unitId ?? equipment.unitId ?? equipment.unit?.id ?? null;
  const fleetMeta = profileToFleetMeta(
    equipment.fleetProfile,
    equipment.maintenanceEntries,
    equipment.fleetDocuments,
    options?.tenure,
  );
  return {
    id: equipment.id,
    companyId: equipment.companyId,
    unitId: resolvedUnitId,
    hitchPosition: equipment.hitchPosition ?? undefined,
    name: equipment.name,
    serialNumber: equipment.serialNumber,
    lastServiceDate: equipment.lastServiceDate ?? undefined,
    plate: equipment.plate ?? undefined,
    type: equipment.type ?? undefined,
    status: equipment.status ?? undefined,
    trailerBrandAbbr: equipment.trailerBrandAbbr ?? undefined,
    trailerYear: equipment.trailerYear ?? undefined,
    fleetMeta,
    createdAt: toIsoString(equipment.createdAt),
    updatedAt: toIsoString(equipment.updatedAt),
  };
}
