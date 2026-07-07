import { Operator } from 'src/operators/entities/operator.entity';
import { OperatorDocument } from 'src/operators/entities/operator-document.entity';
import { OperatorEmergencyContact } from 'src/operators/entities/operator-emergency-contact.entity';
import { OperatorPrivateInsurance } from 'src/operators/entities/operator-private-insurance.entity';
import { OperatorPublicInsurance } from 'src/operators/entities/operator-public-insurance.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export type OperatorApiResponse = Record<string, unknown>;

export function serializeOperator(operator: Operator): OperatorApiResponse {
  return {
    id: operator.id,
    companyId: operator.companyId,
    name: operator.name,
    portalUsername: operator.portalUsername ?? null,
    photoDataUrl: operator.photoDataUrl ?? '',
    birthDate: operator.birthDate ?? null,
    curp: operator.curp ?? '',
    rfc: operator.rfc ?? '',
    licenseNumber: operator.licenseNumber ?? '',
    licenseExpiresOn: operator.licenseExpiresOn ?? null,
    licenseType: operator.licenseType,
    licenseEndorsements: operator.licenseEndorsements ?? '',
    phone: operator.phone ?? '',
    phoneSecondary: operator.phoneSecondary ?? '',
    address: operator.address ?? '',
    companyHireDate: operator.companyHireDate ?? null,
    employmentContractType: operator.employmentContractType ?? '',
    paymentSchedule: operator.paymentSchedule ?? 'maneuver',
    paymentMethod: operator.paymentMethod?.trim() || null,
    status: operator.status,
    isActive: operator.isActive !== false,
    insuranceKind: operator.insuranceKind,
    maneuverCount:
      typeof operator.maneuverCount === 'number' ? operator.maneuverCount : undefined,
    lastManeuver: operator.lastManeuver
      ? {
          tripId: operator.lastManeuver.tripId,
          maneuverCode: operator.lastManeuver.maneuverCode,
          origin: operator.lastManeuver.origin,
          destination: operator.lastManeuver.destination,
          status: operator.lastManeuver.status,
          occurredOn: operator.lastManeuver.occurredOn ?? null,
        }
      : undefined,
    nextPayDueOn: operator.nextPayDueOn ?? null,
    nextPayDueVariant: operator.nextPayDueVariant ?? null,
    owedAmount:
      typeof operator.owedAmount === 'number' && Number.isFinite(operator.owedAmount)
        ? operator.owedAmount
        : null,
    createdAt: toIsoString(operator.createdAt),
    updatedAt: toIsoString(operator.updatedAt),
    emergencyContact: operator.emergencyContact
      ? serializeEmergencyContact(operator.emergencyContact, operator.id)
      : undefined,
    publicInsurance: operator.publicInsurance
      ? serializePublicInsurance(operator.publicInsurance, operator.id)
      : undefined,
    privateInsurance: operator.privateInsurance
      ? serializePrivateInsurance(operator.privateInsurance, operator.id)
      : undefined,
    documents: (operator.documents ?? []).map((d) =>
      serializeOperatorDocument(d, operator.id),
    ),
  };
}

function serializeEmergencyContact(
  row: OperatorEmergencyContact,
  operatorId: number,
): Record<string, unknown> {
  return {
    operatorId,
    name: row.name,
    relationship: row.relationship,
    phone: row.phone,
    email: row.email,
    authorizedMedicalInfo: row.authorizedMedicalInfo,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializePublicInsurance(
  row: OperatorPublicInsurance,
  operatorId: number,
): Record<string, unknown> {
  return {
    operatorId,
    nss: row.nss,
    imssAltaDate: row.imssAltaDate ?? null,
    infonavit: row.infonavit,
    infonavitCreditNumber: row.infonavitCreditNumber,
    fonacot: row.fonacot,
    fonacotCreditNumber: row.fonacotCreditNumber,
    notes: row.notes,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializePrivateInsurance(
  row: OperatorPrivateInsurance,
  operatorId: number,
): Record<string, unknown> {
  return {
    operatorId,
    carrier: row.carrier,
    policyNumber: row.policyNumber,
    validFrom: row.validFrom ?? null,
    validTo: row.validTo ?? null,
    premiumAmount: row.premiumAmount,
    premiumPeriod: row.premiumPeriod,
    deductibleNotes: row.deductibleNotes,
    planSummary: row.planSummary,
    updatedAt: toIsoString(row.updatedAt),
  };
}

function serializeOperatorDocument(
  row: OperatorDocument,
  operatorId: number,
): Record<string, unknown> {
  return {
    id: row.id,
    operatorId,
    fileName: row.fileName,
    slot: row.slot,
    addedAt: row.addedAt,
    sortOrder: row.sortOrder,
  };
}
