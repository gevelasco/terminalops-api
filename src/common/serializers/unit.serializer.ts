import { Unit } from 'src/units/entities/unit.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';
import { profileToFleetMeta } from 'src/units/mappers/unit-fleet-meta.mapper';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { recomputeLastMaintenanceFields } from 'src/fleet/fleet-maintenance-expense-sync.util';

export type SerializeUnitOptions = {
  tenure?: FleetAssetTenure | null;
  /** Listado: sin historial/docs/tenure en fleetMeta. */
  list?: boolean;
};

export function serializeUnit(
  unit: Unit,
  options?: SerializeUnitOptions,
): Record<string, unknown> {
  const list = options?.list === true;
  const fleetMeta = profileToFleetMeta(
    unit.fleetProfile,
    unit.maintenanceEntries,
    list ? undefined : unit.fleetDocuments,
    list ? undefined : options?.tenure,
    unit.verificationEntries,
    { includeHistory: !list },
  );

  return {
    id: unit.id,
    companyId: unit.companyId,
    plate: unit.plate,
    transportType: unit.transportType ?? undefined,
    capacityKg: unit.capacityKg,
    status: unit.status,
    isActive: unit.isActive !== false,
    serialNumber: unit.serialNumber ?? undefined,
    motorNumber: unit.motorNumber ?? undefined,
    // Derivado: UI trabaja en toneladas; canónico en DB es capacity_kg.
    capacityTons:
      unit.capacityKg > 0
        ? Math.round((unit.capacityKg / 1000) * 100) / 100
        : undefined,
    name: unit.name ?? undefined,
    trailerBrandAbbr: unit.trailerBrandAbbr ?? undefined,
    trailerYear: unit.trailerYear ?? undefined,
    fleetMeta,
    equipment: (unit.equipment ?? []).map((e) =>
      serializeEquipmentRef(e, unit.id, list),
    ),
    createdAt: toIsoString(unit.createdAt),
    updatedAt: toIsoString(unit.updatedAt),
  };
}

function serializeEquipmentRef(
  equipment: Equipment,
  unitId: number,
  list: boolean,
): Record<string, unknown> {
  const lastMaint = list
    ? null
    : recomputeLastMaintenanceFields(equipment.maintenanceEntries ?? []);
  return {
    id: equipment.id,
    companyId: equipment.companyId,
    unitId,
    name: equipment.name,
    serialNumber: equipment.serialNumber,
    lastServiceDate: lastMaint?.lastMaintenanceDate ?? undefined,
    plate: equipment.plate ?? undefined,
    type: equipment.type ?? undefined,
    status: equipment.status ?? undefined,
    isActive: equipment.isActive !== false,
    // Necesarios para armar el código operativo (MARCA-AÑO-PLACA) y ordenar
    // el convoy (lead/rear) sin descargar el catálogo completo de /equipment.
    trailerBrandAbbr: equipment.trailerBrandAbbr ?? undefined,
    trailerYear: equipment.trailerYear ?? undefined,
    hitchPosition: equipment.hitchPosition ?? undefined,
  };
}
