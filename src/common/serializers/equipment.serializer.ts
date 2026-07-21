import { Equipment } from 'src/equipment/entities/equipment.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';
import { profileToFleetMeta } from 'src/equipment/mappers/equipment-fleet-meta.mapper';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { recomputeLastMaintenanceFields } from 'src/fleet/fleet-maintenance-expense-sync.util';

export type SerializeEquipmentOptions = {
  unitId?: number | null;
  tenure?: FleetAssetTenure | null;
  /** Listado: sin historial/docs/tenure en fleetMeta. */
  list?: boolean;
};

export function serializeEquipment(
  equipment: Equipment,
  options?: SerializeEquipmentOptions,
): Record<string, unknown> {
  const list = options?.list === true;
  const resolvedUnitId =
    options?.unitId ?? equipment.unitId ?? equipment.unit?.id ?? null;
  const fleetMeta = profileToFleetMeta(
    equipment.fleetProfile,
    equipment.maintenanceEntries,
    list ? undefined : equipment.fleetDocuments,
    list ? undefined : options?.tenure,
    equipment.verificationEntries,
    { includeHistory: !list },
  );
  const lastMaint = recomputeLastMaintenanceFields(
    equipment.maintenanceEntries ?? [],
  );
  return {
    id: equipment.id,
    companyId: equipment.companyId,
    unitId: resolvedUnitId,
    hitchPosition: equipment.hitchPosition ?? undefined,
    name: equipment.name,
    serialNumber: equipment.serialNumber,
    lastServiceDate: lastMaint.lastMaintenanceDate ?? undefined,
    plate: equipment.plate ?? undefined,
    type: equipment.type ?? undefined,
    status: equipment.status ?? undefined,
    isActive: equipment.isActive !== false,
    trailerBrandAbbr: equipment.trailerBrandAbbr ?? undefined,
    trailerYear: equipment.trailerYear ?? undefined,
    fleetMeta,
    createdAt: toIsoString(equipment.createdAt),
    updatedAt: toIsoString(equipment.updatedAt),
  };
}
