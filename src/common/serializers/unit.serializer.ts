import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';
import { profileToFleetMeta } from 'src/units/mappers/unit-fleet-meta.mapper';

export function serializeUnit(
  unit: Unit,
  companyPublicId: number,
): Record<string, unknown> {
  const fleetMeta = profileToFleetMeta(
    unit.fleetProfile,
    unit.maintenanceEntries,
    unit.fleetDocuments,
  );

  return {
    id: unit.publicId,
    companyId: companyPublicId,
    plate: unit.plate,
    type: unit.type,
    capacityKg: unit.capacityKg,
    status: unit.status,
    serialNumber: unit.serialNumber ?? undefined,
    name: unit.name ?? undefined,
    trailerBrandAbbr: unit.trailerBrandAbbr ?? undefined,
    trailerYear: unit.trailerYear ?? undefined,
    fleetMeta,
    equipment: (unit.equipment ?? []).map((e) =>
      serializeEquipmentRef(e, companyPublicId, unit.publicId),
    ),
    createdAt: toIsoString(unit.createdAt),
    updatedAt: toIsoString(unit.updatedAt),
  };
}

function serializeEquipmentRef(
  equipment: Equipment,
  companyPublicId: number,
  unitPublicId: number,
): Record<string, unknown> {
  return {
    id: equipment.publicId,
    companyId: companyPublicId,
    unitId: unitPublicId,
    name: equipment.name,
    serialNumber: equipment.serialNumber,
    lastServiceDate: equipment.lastServiceDate ?? undefined,
    plate: equipment.plate ?? undefined,
    type: equipment.type ?? undefined,
    status: equipment.status ?? undefined,
  };
}
