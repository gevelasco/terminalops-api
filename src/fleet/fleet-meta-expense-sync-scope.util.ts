type FleetMetaLike = object | null | undefined;

function readFleetMetaField(source: FleetMetaLike, field: string): unknown {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  return (source as Record<string, unknown>)[field];
}

/** Campo presente en el PATCH (no solo en la instancia DTO de Nest con `undefined`). */
export function fleetMetaFieldProvided(source: FleetMetaLike, field: string): boolean {
  if (!source || typeof source !== 'object' || !(field in source)) {
    return false;
  }
  return readFleetMetaField(source, field) !== undefined;
}

const UNIT_INSURANCE_FIELDS = [
  'insuranceCarrierName',
  'insurancePolicyNumber',
  'insurancePaymentCadence',
  'insuranceContractDate',
  'insuranceLastPaymentDate',
  'insuranceCost',
  'insurancePaymentMethod',
  'insuranceInvoiceRequired',
] as const;

const UNIT_INSURANCE_CONFIG_FIELDS = UNIT_INSURANCE_FIELDS.filter(
  (field) => field !== 'insuranceLastPaymentDate',
);

const UNIT_GPS_FIELDS = [
  'hasGps',
  'gpsProviderBrand',
  'gpsPrice',
  'gpsPaymentCadence',
  'gpsContractDate',
  'gpsLastPaymentDate',
  'gpsPaymentMethod',
  'gpsInvoiceRequired',
  'gpsTrackingPortalUrl',
  'gpsCoveredByInsuranceEndorsement',
] as const;

const UNIT_GPS_CONFIG_FIELDS = UNIT_GPS_FIELDS.filter(
  (field) => field !== 'gpsLastPaymentDate',
);

const UNIT_VERIFICATION_FIELDS = [
  'verificationPhysMechDate',
  'verificationPhysMechCost',
  'verificationEmissionsDate',
  'verificationEmissionsCost',
  'verificationDoubleArticulatedApplies',
  'verificationDoubleArticulatedDate',
  'verificationDoubleArticulatedCost',
] as const;

function isDateField(field: string): boolean {
  return field.endsWith('Date');
}

function isNumericFleetMetaField(field: string): boolean {
  return (
    field.includes('Cost') ||
    field.includes('Price') ||
    field === 'maintenanceKmCounter'
  );
}

function normalizeFleetMetaScalar(value: unknown, field?: string): string {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  const raw = String(value).trim();
  if (field && isDateField(field)) {
    const ymd = /^(\d{4}-\d{2}-\d{2})/.exec(raw)?.[1];
    if (ymd) {
      return ymd;
    }
  }
  if (field && isNumericFleetMetaField(field)) {
    const n = Number(raw.replace(/,/g, ''));
    if (Number.isFinite(n)) {
      return String(n);
    }
  }
  return raw;
}

export function fleetMetaFieldsTouched(
  fields: readonly string[],
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  if (!incoming) {
    return false;
  }
  return fields.some((field) => {
    if (!fleetMetaFieldProvided(incoming, field)) {
      return false;
    }
    return (
      normalizeFleetMetaScalar(readFleetMetaField(incoming, field), field) !==
      normalizeFleetMetaScalar(readFleetMetaField(previous, field), field)
    );
  });
}

export function unitFleetMetaInsuranceTouched(
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  return fleetMetaFieldsTouched(UNIT_INSURANCE_FIELDS, previous, incoming);
}

export function unitFleetMetaInsurancePaymentDateTouched(
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  return fleetMetaFieldsTouched(['insuranceLastPaymentDate'], previous, incoming);
}

export function unitFleetMetaInsuranceConfigTouched(
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  return fleetMetaFieldsTouched(UNIT_INSURANCE_CONFIG_FIELDS, previous, incoming);
}

export function unitFleetMetaGpsTouched(
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  return fleetMetaFieldsTouched(UNIT_GPS_FIELDS, previous, incoming);
}

export function unitFleetMetaGpsPaymentDateTouched(
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  return fleetMetaFieldsTouched(['gpsLastPaymentDate'], previous, incoming);
}

export function unitFleetMetaGpsConfigTouched(
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  return fleetMetaFieldsTouched(UNIT_GPS_CONFIG_FIELDS, previous, incoming);
}

export function unitFleetMetaVerificationTouched(
  previous: FleetMetaLike,
  incoming: FleetMetaLike,
): boolean {
  return fleetMetaFieldsTouched(UNIT_VERIFICATION_FIELDS, previous, incoming);
}
