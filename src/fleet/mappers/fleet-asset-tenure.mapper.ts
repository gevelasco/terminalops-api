import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';

const TENURE_CODES = ['owned', 'financed', 'leased', 'managed'] as const;

export function normalizeTenureMode(value?: string | null): string | undefined {
  const t = value?.trim();
  if (!t) {
    return undefined;
  }
  if ((TENURE_CODES as readonly string[]).includes(t)) {
    return t;
  }
  const byLabel: Record<string, string> = {
    propio: 'owned',
    financiado: 'financed',
    arrendado: 'leased',
    administrado: 'managed',
  };
  return byLabel[t.toLowerCase()] ?? undefined;
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

function emptyDateToUndefined(value?: string): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export type FleetMetaTenureFields = {
  trailerTenureMode?: string;
  trailerCommercialValue?: number;
  trailerRecurringPaymentAmount?: number;
  trailerRecurringPaymentDate?: string;
  trailerRecurringInstallmentCount?: number;
  trailerManagementOwnerPayout?: number;
};

/** Filas de tenure: `null` limpia columnas nullable en Postgres. */
export type FleetAssetTenureUpsert = {
  [K in keyof FleetAssetTenure]?: FleetAssetTenure[K] | null;
};

export function fleetMetaDtoHasTenureFields(meta: FleetMetaTenureFields): boolean {
  return (
    meta.trailerTenureMode !== undefined ||
    meta.trailerCommercialValue !== undefined ||
    meta.trailerRecurringPaymentAmount !== undefined ||
    meta.trailerRecurringPaymentDate !== undefined ||
    meta.trailerRecurringInstallmentCount !== undefined ||
    meta.trailerManagementOwnerPayout !== undefined
  );
}

function numericFieldToDb(
  value: number | null | undefined,
): string | null | undefined {
  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return undefined;
  }
  return numToDb(value) ?? null;
}

export function fleetMetaDtoToTenureRow(
  companyId: number,
  subject: { unitId: number } | { equipmentId: number },
  meta: FleetMetaTenureFields,
): FleetAssetTenureUpsert {
  const row: FleetAssetTenureUpsert = {
    companyId,
    ...('unitId' in subject ? { unitId: subject.unitId, equipmentId: null } : {}),
    ...('equipmentId' in subject
      ? { equipmentId: subject.equipmentId, unitId: null }
      : {}),
  };

  if (meta.trailerTenureMode !== undefined) {
    const mode = normalizeTenureMode(meta.trailerTenureMode) ?? 'owned';
    row.tenureMode = mode;
    if (mode === 'owned') {
      row.recurringPaymentAmount = null;
      row.recurringPaymentDate = null;
      row.recurringInstallmentCount = null;
      row.managementOwnerPayout = null;
    } else if (mode === 'financed' || mode === 'leased') {
      row.commercialValue = null;
      row.managementOwnerPayout = null;
    } else if (mode === 'managed') {
      row.commercialValue = null;
      row.recurringPaymentAmount = null;
      row.recurringPaymentDate = null;
      row.recurringInstallmentCount = null;
    }
  }

  if (meta.trailerCommercialValue !== undefined) {
    row.commercialValue = numericFieldToDb(meta.trailerCommercialValue);
  }
  if (meta.trailerRecurringPaymentAmount !== undefined) {
    row.recurringPaymentAmount = numericFieldToDb(meta.trailerRecurringPaymentAmount);
  }
  if (meta.trailerRecurringPaymentDate !== undefined) {
    const date = meta.trailerRecurringPaymentDate;
    row.recurringPaymentDate =
      date === null ? null : emptyDateToUndefined(date) ?? null;
  }
  if (meta.trailerRecurringInstallmentCount !== undefined) {
    row.recurringInstallmentCount = meta.trailerRecurringInstallmentCount ?? null;
  }
  if (meta.trailerManagementOwnerPayout !== undefined) {
    row.managementOwnerPayout = numericFieldToDb(meta.trailerManagementOwnerPayout);
  }

  return row;
}

export function tenureEntityToFleetMetaFields(
  tenure: FleetAssetTenure | undefined | null,
): FleetMetaTenureFields | undefined {
  if (!tenure) {
    return undefined;
  }
  const fields: FleetMetaTenureFields = {
    trailerTenureMode: tenure.tenureMode ?? undefined,
    trailerCommercialValue: dbNumToApi(tenure.commercialValue),
    trailerRecurringPaymentAmount: dbNumToApi(tenure.recurringPaymentAmount),
    trailerRecurringPaymentDate: tenure.recurringPaymentDate ?? undefined,
    trailerRecurringInstallmentCount: tenure.recurringInstallmentCount ?? undefined,
    trailerManagementOwnerPayout: dbNumToApi(tenure.managementOwnerPayout),
  };
  const hasValue = Object.values(fields).some((v) => v !== undefined);
  return hasValue ? fields : undefined;
}

export function mergeTenureIntoFleetMeta(
  meta: Record<string, unknown> | undefined,
  tenure: FleetAssetTenure | undefined | null,
): Record<string, unknown> | undefined {
  const tenureFields = tenureEntityToFleetMetaFields(tenure);
  if (!tenureFields) {
    return meta;
  }
  return { ...(meta ?? {}), ...tenureFields };
}

export function fleetTenureMapKey(
  subject: { unitId: number } | { equipmentId: number },
): string {
  return 'unitId' in subject ? `unit:${subject.unitId}` : `equipment:${subject.equipmentId}`;
}
