import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';
import { profileToFleetMeta } from 'src/units/mappers/unit-fleet-meta.mapper';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';

export type SerializeUnitOptions = { tenure?: FleetAssetTenure | null };

export function serializeUnit(
  unit: Unit,
  options?: SerializeUnitOptions,
): Record<string, unknown> {
  const fleetMeta = profileToFleetMeta(
    unit.fleetProfile,
    unit.maintenanceEntries,
    unit.fleetDocuments,
    options?.tenure,
  );

  return {
    id: unit.id,
    companyId: unit.companyId,
    plate: unit.plate,
    capacityKg: unit.capacityKg,
    status: unit.status,
    serialNumber: unit.serialNumber ?? undefined,
    name: unit.name ?? undefined,
    trailerBrandAbbr: unit.trailerBrandAbbr ?? undefined,
    trailerYear: unit.trailerYear ?? undefined,
    fleetMeta,
    equipment: (unit.equipment ?? []).map((e) => serializeEquipmentRef(e, unit.id)),
    createdAt: toIsoString(unit.createdAt),
    updatedAt: toIsoString(unit.updatedAt),
  };
}

function serializeEquipmentRef(
  equipment: Equipment,
  unitId: number,
): Record<string, unknown> {
  return {
    id: equipment.id,
    companyId: equipment.companyId,
    unitId,
    name: equipment.name,
    serialNumber: equipment.serialNumber,
    lastServiceDate: equipment.lastServiceDate ?? undefined,
    plate: equipment.plate ?? undefined,
    type: equipment.type ?? undefined,
    status: equipment.status ?? undefined,
  };
}
