import { EquipmentFleetDocument } from 'src/equipment/entities/equipment-fleet-document.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import type { CreateEquipmentFleetMetaDto } from 'src/equipment/dto/create-equipment-fleet-meta.dto';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { mergeTenureIntoFleetMeta } from 'src/fleet/mappers/fleet-asset-tenure.mapper';

function emptyDateToUndefined(value?: string): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function numToDb(value?: number | null): string | undefined {
  if (value == null || Number.isNaN(value)) {
    return undefined;
  }
  return String(value);
}

function dbNumToApi(value?: string | null): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

const DOCUMENT_KINDS = [
  ['documentMaintenanceNames', 'maintenance'],
  ['documentVerificationNames', 'verification'],
  ['documentPolicyNames', 'policy'],
  ['documentOwnershipNames', 'ownership'],
] as const;

export function fleetMetaDtoToProfile(
  equipmentId: number,
  meta: CreateEquipmentFleetMetaDto,
): Partial<EquipmentFleetProfile> {
  return {
    equipmentId,
    trailerBrandName: meta.trailerBrandName?.trim() || undefined,
    trailerVersion: meta.trailerVersion?.trim() || undefined,
    trailerColor: meta.trailerColor?.trim() || undefined,
    equipmentCapacityTons: meta.equipmentCapacityTons?.trim() || undefined,
    equipmentAxleCount: meta.equipmentAxleCount,
    equipmentContainerSlotConfig: meta.equipmentContainerSlotConfig?.trim() || undefined,
    equipmentTireCount: meta.equipmentTireCount,
    lastMaintenanceDate: emptyDateToUndefined(meta.lastMaintenanceDate),
    lastMaintenanceType: meta.lastMaintenanceType?.trim() || undefined,
    lastMaintenanceCost: numToDb(meta.lastMaintenanceCost),
    lastMaintenanceNotes: meta.lastMaintenanceNotes?.trim() || undefined,
    tireCondition: meta.tireCondition?.trim() || undefined,
    maintenanceAlertByKm: meta.maintenanceAlertByKm,
    maintenanceNextDateOverride: emptyDateToUndefined(meta.maintenanceNextDateOverride),
    maintenanceKmInterval: numToDb(meta.maintenanceKmInterval),
    maintenanceTripKmAtLastService: numToDb(meta.maintenanceTripKmAtLastService),
    maintenanceKmRemaining: numToDb(meta.maintenanceKmRemaining),
    verificationPhysMechDate: emptyDateToUndefined(meta.verificationPhysMechDate),
    verificationPhysMechCost: numToDb(meta.verificationPhysMechCost),
    equipmentOperatedByAgency: meta.equipmentOperatedByAgency,
    physMechTwoYearExemptStartDate: emptyDateToUndefined(meta.physMechTwoYearExemptStartDate),
    insurancePolicyNumber: meta.insurancePolicyNumber?.trim() || undefined,
    insuranceCarrierName: meta.insuranceCarrierName?.trim() || undefined,
    insurancePaymentCadence: meta.insurancePaymentCadence?.trim() || undefined,
    insuranceContractDate: emptyDateToUndefined(meta.insuranceContractDate),
    insuranceCost: numToDb(meta.insuranceCost),
  };
}

export function fleetMetaDtoToDocuments(
  equipmentId: number,
  meta: CreateEquipmentFleetMetaDto,
): Partial<EquipmentFleetDocument>[] {
  const rows: Partial<EquipmentFleetDocument>[] = [];
  for (const [field, kind] of DOCUMENT_KINDS) {
    const names = meta[field];
    if (!names?.length) {
      continue;
    }
    for (const fileName of names) {
      const trimmed = fileName.trim();
      if (!trimmed) {
        continue;
      }
      rows.push({
        equipmentId,
        documentKind: kind,
        fileName: trimmed,
      });
    }
  }
  return rows;
}

export function fleetMetaDtoToMaintenanceEntries(
  equipmentId: number,
  meta: CreateEquipmentFleetMetaDto,
): Partial<FleetMaintenanceEntry>[] {
  if (!meta.maintenanceEntries?.length) {
    return [];
  }
  return meta.maintenanceEntries.map((entry, index) => ({
    equipmentId,
    entryDate: emptyDateToUndefined(entry.date),
    entryType: entry.type?.trim() || undefined,
    cost: numToDb(entry.cost),
    notes: entry.notes?.trim() || undefined,
    status: entry.status,
    sortOrder: index,
  }));
}

function documentNamesByKind(
  documents: EquipmentFleetDocument[] | undefined,
  kind: string,
): string[] | undefined {
  const names = (documents ?? [])
    .filter((d) => d.documentKind === kind)
    .map((d) => d.fileName)
    .filter(Boolean);
  return names.length > 0 ? names : undefined;
}

export function profileToFleetMeta(
  profile: EquipmentFleetProfile | undefined,
  maintenanceEntries: FleetMaintenanceEntry[] | undefined,
  documents: EquipmentFleetDocument[] | undefined,
  tenure?: FleetAssetTenure | null,
): Record<string, unknown> | undefined {
  if (!profile && !maintenanceEntries?.length && !documents?.length) {
    return undefined;
  }

  const meta: Record<string, unknown> = profile
    ? {
        trailerBrandName: profile.trailerBrandName ?? undefined,
        trailerVersion: profile.trailerVersion ?? undefined,
        trailerColor: profile.trailerColor ?? undefined,
        equipmentCapacityTons: profile.equipmentCapacityTons ?? undefined,
        equipmentAxleCount: profile.equipmentAxleCount ?? undefined,
        equipmentContainerSlotConfig: profile.equipmentContainerSlotConfig ?? undefined,
        equipmentTireCount: profile.equipmentTireCount ?? undefined,
        lastMaintenanceDate: profile.lastMaintenanceDate ?? undefined,
        lastMaintenanceType: profile.lastMaintenanceType ?? undefined,
        lastMaintenanceCost: dbNumToApi(profile.lastMaintenanceCost),
        lastMaintenanceNotes: profile.lastMaintenanceNotes ?? undefined,
        tireCondition: profile.tireCondition ?? undefined,
        maintenanceAlertByKm: profile.maintenanceAlertByKm ?? undefined,
        maintenanceNextDateOverride: profile.maintenanceNextDateOverride ?? undefined,
        maintenanceKmInterval: dbNumToApi(profile.maintenanceKmInterval),
        maintenanceTripKmAtLastService: dbNumToApi(profile.maintenanceTripKmAtLastService),
        maintenanceKmRemaining: dbNumToApi(profile.maintenanceKmRemaining),
        verificationPhysMechDate: profile.verificationPhysMechDate ?? undefined,
        verificationPhysMechCost: dbNumToApi(profile.verificationPhysMechCost),
        equipmentOperatedByAgency: profile.equipmentOperatedByAgency ?? undefined,
        physMechTwoYearExemptStartDate:
          profile.physMechTwoYearExemptStartDate ?? undefined,
        insurancePolicyNumber: profile.insurancePolicyNumber ?? undefined,
        insuranceCarrierName: profile.insuranceCarrierName ?? undefined,
        insurancePaymentCadence: profile.insurancePaymentCadence ?? undefined,
        insuranceContractDate: profile.insuranceContractDate ?? undefined,
        insuranceCost: dbNumToApi(profile.insuranceCost),
      }
    : {};

  const entries = (maintenanceEntries ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((e) => ({
      date: e.entryDate ?? undefined,
      type: e.entryType ?? undefined,
      cost: dbNumToApi(e.cost),
      notes: e.notes ?? undefined,
      status: e.status ?? undefined,
    }))
    .filter((e) => e.date || e.type || e.cost != null || e.notes || e.status);
  if (entries.length > 0) {
    meta['maintenanceEntries'] = entries;
  }

  for (const [field, kind] of DOCUMENT_KINDS) {
    const names = documentNamesByKind(documents, kind);
    if (names) {
      meta[field] = names;
    }
  }

  const withTenure = mergeTenureIntoFleetMeta(
    Object.keys(meta).length > 0 ? meta : undefined,
    tenure,
  );
  return withTenure && Object.keys(withTenure).length > 0 ? withTenure : undefined;
}

