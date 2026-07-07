import { UnitFleetDocument } from 'src/units/entities/unit-fleet-document.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import type { CreateUnitFleetMetaDto } from 'src/units/dto/create-unit-fleet-meta.dto';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { mergeTenureIntoFleetMeta } from 'src/fleet/mappers/fleet-asset-tenure.mapper';
import { isSubstantiveMaintenanceEntry } from 'src/fleet/fleet-maintenance-expense-sync.util';

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
  unitId: number,
  meta: CreateUnitFleetMetaDto,
): Partial<UnitFleetProfile> {
  return {
    unitId,
    trailerBrandName: meta.trailerBrandName?.trim() || undefined,
    trailerVersion: meta.trailerVersion?.trim() || undefined,
    trailerColor: meta.trailerColor?.trim() || undefined,
    serviceModality: meta.serviceModality?.trim() || undefined,
    transmissionType: meta.transmissionType?.trim() || undefined,
    transmissionSpeeds: meta.transmissionSpeeds?.trim() || undefined,
    grossVehicleWeightLb: meta.grossVehicleWeightLb?.trim() || undefined,
    odometerKm: meta.odometerKm?.trim() || undefined,
    lastMaintenanceDate: emptyDateToUndefined(meta.lastMaintenanceDate),
    lastMaintenanceType: meta.lastMaintenanceType?.trim() || undefined,
    lastMaintenanceCost: numToDb(meta.lastMaintenanceCost),
    lastMaintenanceNotes: meta.lastMaintenanceNotes?.trim() || undefined,
    tireCondition: meta.tireCondition?.trim() || undefined,
    maintenanceNextDateOverride: emptyDateToUndefined(meta.maintenanceNextDateOverride),
    maintenanceKmCounter: numToDb(meta.maintenanceKmCounter ?? 0),
    verificationPhysMechDate: emptyDateToUndefined(meta.verificationPhysMechDate),
    verificationPhysMechCost: numToDb(meta.verificationPhysMechCost),
    verificationEmissionsDate: emptyDateToUndefined(meta.verificationEmissionsDate),
    verificationEmissionsCost: numToDb(meta.verificationEmissionsCost),
    verificationDoubleArticulatedApplies: meta.verificationDoubleArticulatedApplies,
    verificationDoubleArticulatedDate: emptyDateToUndefined(
      meta.verificationDoubleArticulatedDate,
    ),
    verificationDoubleArticulatedCost: numToDb(
      meta.verificationDoubleArticulatedCost,
    ),
    insurancePolicyNumber: meta.insurancePolicyNumber?.trim() || undefined,
    insuranceCarrierName: meta.insuranceCarrierName?.trim() || undefined,
    insurancePaymentCadence: meta.insurancePaymentCadence?.trim() || undefined,
    insuranceContractDate: emptyDateToUndefined(meta.insuranceContractDate),
    insuranceLastPaymentDate: emptyDateToUndefined(meta.insuranceLastPaymentDate),
    insuranceCost: numToDb(meta.insuranceCost),
    insurancePaymentMethod: meta.insurancePaymentMethod?.trim() || undefined,
    insuranceInvoiceRequired: meta.insuranceInvoiceRequired === true,
    hasGps: meta.hasGps,
    gpsProviderBrand: meta.gpsProviderBrand?.trim() || undefined,
    gpsPrice: numToDb(meta.gpsPrice),
    gpsPaymentCadence: meta.gpsPaymentCadence?.trim() || undefined,
    gpsContractDate: emptyDateToUndefined(meta.gpsContractDate),
    gpsLastPaymentDate: emptyDateToUndefined(meta.gpsLastPaymentDate),
    gpsPaymentMethod: meta.gpsPaymentMethod?.trim() || undefined,
    gpsInvoiceRequired: meta.gpsInvoiceRequired === true,
    gpsTrackingPortalUrl: meta.gpsTrackingPortalUrl?.trim() || undefined,
    gpsCoveredByInsuranceEndorsement: meta.gpsCoveredByInsuranceEndorsement,
  };
}

export function fleetMetaDtoToDocuments(
  unitId: number,
  meta: CreateUnitFleetMetaDto,
): Partial<UnitFleetDocument>[] {
  const rows: Partial<UnitFleetDocument>[] = [];
  let sort = 0;
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
        unitId,
        documentKind: kind,
        fileName: trimmed,
        sortOrder: sort++,
      });
    }
  }
  return rows;
}

export function fleetMetaDtoToMaintenanceEntries(
  unitId: number,
  meta: CreateUnitFleetMetaDto,
): Partial<FleetMaintenanceEntry>[] {
  if (!meta.maintenanceEntries?.length) {
    return [];
  }
  return meta.maintenanceEntries
    .filter(isSubstantiveMaintenanceEntry)
    .map((entry, index) => ({
      unitId,
      entryDate: emptyDateToUndefined(entry.date),
      entryType: entry.type?.trim() || undefined,
      cost: numToDb(entry.cost),
      notes: entry.notes?.trim() || undefined,
      paymentMethod: entry.paymentMethod?.trim() || undefined,
      status: entry.status ?? 'concluido',
      sortOrder: index,
    }));
}

function documentNamesByKind(
  documents: UnitFleetDocument[] | undefined,
  kind: string,
): string[] | undefined {
  const names = (documents ?? [])
    .filter((d) => d.documentKind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => d.fileName)
    .filter(Boolean);
  return names.length > 0 ? names : undefined;
}

export function profileToFleetMeta(
  profile: UnitFleetProfile | undefined,
  maintenanceEntries: FleetMaintenanceEntry[] | undefined,
  documents: UnitFleetDocument[] | undefined,
  tenure?: FleetAssetTenure | null,
): Record<string, unknown> | undefined {
  if (!profile && !maintenanceEntries?.length && !documents?.length && !tenure) {
    return undefined;
  }

  const meta: Record<string, unknown> = profile
    ? {
        trailerBrandName: profile.trailerBrandName ?? undefined,
        trailerVersion: profile.trailerVersion ?? undefined,
        trailerColor: profile.trailerColor ?? undefined,
        serviceModality: profile.serviceModality ?? undefined,
        transmissionType: profile.transmissionType ?? undefined,
        transmissionSpeeds: profile.transmissionSpeeds ?? undefined,
        grossVehicleWeightLb: profile.grossVehicleWeightLb ?? undefined,
        odometerKm: profile.odometerKm ?? undefined,
        lastMaintenanceDate: profile.lastMaintenanceDate ?? undefined,
        lastMaintenanceType: profile.lastMaintenanceType ?? undefined,
        lastMaintenanceCost: dbNumToApi(profile.lastMaintenanceCost),
        lastMaintenanceNotes: profile.lastMaintenanceNotes ?? undefined,
        tireCondition: profile.tireCondition ?? undefined,
        maintenanceNextDateOverride:
          profile.maintenanceNextDateOverride ?? undefined,
        maintenanceKmCounter: dbNumToApi(profile.maintenanceKmCounter) ?? 0,
        verificationPhysMechDate: profile.verificationPhysMechDate ?? undefined,
        verificationPhysMechCost: dbNumToApi(profile.verificationPhysMechCost),
        verificationEmissionsDate: profile.verificationEmissionsDate ?? undefined,
        verificationEmissionsCost: dbNumToApi(profile.verificationEmissionsCost),
        verificationDoubleArticulatedApplies:
          profile.verificationDoubleArticulatedApplies ?? undefined,
        verificationDoubleArticulatedDate:
          profile.verificationDoubleArticulatedDate ?? undefined,
        verificationDoubleArticulatedCost: dbNumToApi(
          profile.verificationDoubleArticulatedCost,
        ),
        insurancePolicyNumber: profile.insurancePolicyNumber ?? undefined,
        insuranceCarrierName: profile.insuranceCarrierName ?? undefined,
        insurancePaymentCadence: profile.insurancePaymentCadence ?? undefined,
        insuranceContractDate: profile.insuranceContractDate ?? undefined,
        insuranceLastPaymentDate: profile.insuranceLastPaymentDate ?? undefined,
        insuranceCost: dbNumToApi(profile.insuranceCost),
        insurancePaymentMethod: profile.insurancePaymentMethod ?? undefined,
        insuranceInvoiceRequired: profile.insuranceInvoiceRequired === true,
        hasGps: profile.hasGps ?? undefined,
        gpsProviderBrand: profile.gpsProviderBrand ?? undefined,
        gpsPrice: dbNumToApi(profile.gpsPrice),
        gpsPaymentCadence: profile.gpsPaymentCadence ?? undefined,
        gpsContractDate: profile.gpsContractDate ?? undefined,
        gpsLastPaymentDate: profile.gpsLastPaymentDate ?? undefined,
        gpsPaymentMethod: profile.gpsPaymentMethod ?? undefined,
        gpsInvoiceRequired: profile.gpsInvoiceRequired === true,
        gpsTrackingPortalUrl: profile.gpsTrackingPortalUrl ?? undefined,
        gpsCoveredByInsuranceEndorsement:
          profile.gpsCoveredByInsuranceEndorsement ?? undefined,
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
      paymentMethod: e.paymentMethod ?? undefined,
      status: e.status ?? undefined,
    }))
    .filter(isSubstantiveMaintenanceEntry);
  if (entries.length > 0) {
    meta.maintenanceEntries = entries;
  }

  meta.documentMaintenanceNames = documentNamesByKind(documents, 'maintenance');
  meta.documentVerificationNames = documentNamesByKind(documents, 'verification');
  meta.documentPolicyNames = documentNamesByKind(documents, 'policy');
  meta.documentOwnershipNames = documentNamesByKind(documents, 'ownership');

  const withTenure = mergeTenureIntoFleetMeta(
    Object.keys(meta).length > 0 ? meta : undefined,
    tenure,
  );
  return withTenure && Object.keys(withTenure).length > 0 ? withTenure : undefined;
}
