import { EquipmentFleetDocument } from 'src/equipment/entities/equipment-fleet-document.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';
import type { CreateEquipmentFleetMetaDto } from 'src/equipment/dto/create-equipment-fleet-meta.dto';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { mergeTenureIntoFleetMeta } from 'src/fleet/mappers/fleet-asset-tenure.mapper';
import {
  isSubstantiveMaintenanceEntry,
  maintenanceEntryDateYmd,
  recomputeLastMaintenanceFields,
} from 'src/fleet/fleet-maintenance-expense-sync.util';
import {
  isSubstantiveVerificationEntry,
  verificationEntriesToMetaScalars,
  type VerificationEntryLike,
} from 'src/fleet/fleet-verification-entries.util';
import { fleetMetaFieldProvided } from 'src/fleet/fleet-meta-expense-sync-scope.util';

function emptyDateToUndefined(
  value?: string | Date | null,
): string | undefined {
  const t = maintenanceEntryDateYmd(value);
  return t || undefined;
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
    tireCondition: meta.tireCondition?.trim() || undefined,
    insurancePolicyNumber: meta.insurancePolicyNumber?.trim() || undefined,
    insuranceCarrierName: meta.insuranceCarrierName?.trim() || undefined,
    insurancePaymentCadence: meta.insurancePaymentCadence?.trim() || undefined,
    insuranceContractDate: emptyDateToUndefined(meta.insuranceContractDate),
    insuranceLastPaymentDate: emptyDateToUndefined(meta.insuranceLastPaymentDate),
    insuranceCost: numToDb(meta.insuranceCost),
    insurancePaymentMethod: meta.insurancePaymentMethod?.trim() || undefined,
    insuranceInvoiceRequired: meta.insuranceInvoiceRequired === true,
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

export function lastMaintenanceScalarsProvided(
  meta: CreateEquipmentFleetMetaDto,
): boolean {
  return (
    fleetMetaFieldProvided(meta, 'lastMaintenanceDate') ||
    fleetMetaFieldProvided(meta, 'lastMaintenanceType') ||
    fleetMetaFieldProvided(meta, 'lastMaintenanceCost') ||
    fleetMetaFieldProvided(meta, 'lastMaintenanceNotes')
  );
}

export function synthesizeMaintenanceEntriesFromScalars(
  equipmentId: number,
  meta: CreateEquipmentFleetMetaDto,
): Partial<FleetMaintenanceEntry>[] {
  const date = emptyDateToUndefined(meta.lastMaintenanceDate);
  if (!date) {
    return [];
  }
  return [
    {
      equipmentId,
      entryDate: date,
      entryType: meta.lastMaintenanceType?.trim() || undefined,
      cost: numToDb(meta.lastMaintenanceCost),
      notes: meta.lastMaintenanceNotes?.trim() || undefined,
      sortOrder: 0,
    },
  ];
}

export function fleetMetaDtoToMaintenanceEntries(
  equipmentId: number,
  meta: CreateEquipmentFleetMetaDto,
): Partial<FleetMaintenanceEntry>[] {
  if (meta.maintenanceEntries !== undefined) {
    if (!meta.maintenanceEntries.length) {
      return [];
    }
    return meta.maintenanceEntries
      .filter(isSubstantiveMaintenanceEntry)
      .map((entry, index) => ({
        equipmentId,
        entryDate: emptyDateToUndefined(entry.date),
        entryType: entry.type?.trim() || undefined,
        cost: numToDb(entry.cost),
        notes: entry.notes?.trim() || undefined,
        paymentMethod: entry.paymentMethod?.trim() || undefined,
        sortOrder: index,
      }));
  }
  if (lastMaintenanceScalarsProvided(meta)) {
    return synthesizeMaintenanceEntriesFromScalars(equipmentId, meta);
  }
  return [];
}

export function fleetMetaDtoToVerificationEntries(
  equipmentId: number,
  entries: readonly VerificationEntryLike[],
): Partial<FleetVerificationEntry>[] {
  return entries
    .filter((entry) => entry.scope === 'phys_mech')
    .filter(isSubstantiveVerificationEntry)
    .map((entry, index) => ({
      equipmentId,
      scope: 'phys_mech' as const,
      entryDate: emptyDateToUndefined(
        (entry.date ?? entry.entryDate) ?? undefined,
      ),
      cost: numToDb(
        dbNumToApi(
          entry.cost == null || entry.cost === ''
            ? undefined
            : String(entry.cost),
        ),
      ),
      notes: entry.notes?.trim() || undefined,
      paymentMethod: entry.paymentMethod?.trim() || undefined,
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
  verificationEntries?: FleetVerificationEntry[] | undefined,
  options?: { includeHistory?: boolean },
): Record<string, unknown> | undefined {
  const includeHistory = options?.includeHistory !== false;
  if (
    !profile &&
    !maintenanceEntries?.length &&
    !verificationEntries?.length &&
    !(includeHistory && documents?.length) &&
    !(includeHistory && tenure)
  ) {
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
        tireCondition: profile.tireCondition ?? undefined,
        insurancePolicyNumber: profile.insurancePolicyNumber ?? undefined,
        insuranceCarrierName: profile.insuranceCarrierName ?? undefined,
        insurancePaymentCadence: profile.insurancePaymentCadence ?? undefined,
        insuranceContractDate: profile.insuranceContractDate ?? undefined,
        insuranceLastPaymentDate: profile.insuranceLastPaymentDate ?? undefined,
        insuranceCost: dbNumToApi(profile.insuranceCost),
        insurancePaymentMethod: profile.insurancePaymentMethod ?? undefined,
        insuranceInvoiceRequired: profile.insuranceInvoiceRequired === true,
      }
    : {};

  const lastMaint = recomputeLastMaintenanceFields(maintenanceEntries ?? []);
  if (lastMaint.lastMaintenanceDate) {
    meta.lastMaintenanceDate = lastMaint.lastMaintenanceDate;
    meta.lastMaintenanceType = lastMaint.lastMaintenanceType ?? undefined;
    if (includeHistory) {
      meta.lastMaintenanceCost = dbNumToApi(lastMaint.lastMaintenanceCost);
      meta.lastMaintenanceNotes = lastMaint.lastMaintenanceNotes ?? undefined;
    }
  }

  if (includeHistory) {
    const maintenanceRows = (maintenanceEntries ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => ({
        date: e.entryDate ?? undefined,
        type: e.entryType ?? undefined,
        cost: dbNumToApi(e.cost),
        notes: e.notes ?? undefined,
        paymentMethod: e.paymentMethod ?? undefined,
      }))
      .filter(isSubstantiveMaintenanceEntry);
    if (maintenanceRows.length > 0) {
      meta.maintenanceEntries = maintenanceRows;
    }
  }

  const verificationScalars = verificationEntriesToMetaScalars(verificationEntries);
  Object.assign(meta, verificationScalars);

  if (includeHistory) {
    const verificationRows = (verificationEntries ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((e) => ({
        scope: e.scope,
        date: e.entryDate ?? undefined,
        cost: dbNumToApi(e.cost),
        notes: e.notes ?? undefined,
        paymentMethod: e.paymentMethod ?? undefined,
      }))
      .filter(isSubstantiveVerificationEntry);
    if (verificationRows.length > 0) {
      meta.verificationEntries = verificationRows;
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

  const listKeys = [
    'trailerBrandName',
    'trailerVersion',
    'tireCondition',
    'lastMaintenanceDate',
    'lastMaintenanceType',
    'verificationPhysMechDate',
    'insurancePolicyNumber',
    'insuranceCarrierName',
    'insuranceContractDate',
    'insuranceLastPaymentDate',
    'insurancePaymentCadence',
  ] as const;
  const slim: Record<string, unknown> = {};
  for (const key of listKeys) {
    if (meta[key] !== undefined) {
      slim[key] = meta[key];
    }
  }
  return Object.keys(slim).length > 0 ? slim : undefined;
}

export function verificationMetaFromEntries(
  entries: readonly FleetVerificationEntry[] | undefined,
): Record<string, unknown> {
  return verificationEntriesToMetaScalars(entries);
}
