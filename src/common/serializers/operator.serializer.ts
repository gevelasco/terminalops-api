import { Operator } from 'src/operators/entities/operator.entity';
import { OperatorDocument } from 'src/operators/entities/operator-document.entity';
import { OperatorEmergencyContact } from 'src/operators/entities/operator-emergency-contact.entity';
import { OperatorPrivateInsurance } from 'src/operators/entities/operator-private-insurance.entity';
import { OperatorPublicInsurance } from 'src/operators/entities/operator-public-insurance.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export type OperatorApiResponse = Record<string, unknown>;

export function serializeOperator(
  operator: Operator,
  companyPublicId: number,
): OperatorApiResponse {
  const operatorPublicId = operator.publicId;
  return {
    id: operatorPublicId,
    companyId: companyPublicId,
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
    status: operator.status,
    insuranceKind: operator.insuranceKind,
    createdAt: toIsoString(operator.createdAt),
    updatedAt: toIsoString(operator.updatedAt),
    emergencyContact: operator.emergencyContact
      ? serializeEmergencyContact(operator.emergencyContact, operatorPublicId)
      : undefined,
    publicInsurance: operator.publicInsurance
      ? serializePublicInsurance(operator.publicInsurance, operatorPublicId)
      : undefined,
    privateInsurance: operator.privateInsurance
      ? serializePrivateInsurance(operator.privateInsurance, operatorPublicId)
      : undefined,
    documents: (operator.documents ?? []).map((d) =>
      serializeOperatorDocument(d, operatorPublicId),
    ),
  };
}

function serializeEmergencyContact(
  row: OperatorEmergencyContact,
  operatorPublicId: number,
): Record<string, unknown> {
  return {
    operatorId: operatorPublicId,
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
  operatorPublicId: number,
): Record<string, unknown> {
  return {
    operatorId: operatorPublicId,
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
  operatorPublicId: number,
): Record<string, unknown> {
  return {
    operatorId: operatorPublicId,
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
  operatorPublicId: number,
): Record<string, unknown> {
  return {
    id: row.publicId,
    operatorId: operatorPublicId,
    fileName: row.fileName,
    slot: row.slot,
    addedAt: row.addedAt,
    sortOrder: row.sortOrder,
  };
}
