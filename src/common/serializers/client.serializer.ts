import { Client } from 'src/clients/entities/client.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeClient(
  client: Client,
  companyPublicId: number,
): Record<string, unknown> {
  return {
    id: client.publicId,
    companyId: companyPublicId,
    name: client.name,
    rfc: client.rfc ?? undefined,
    relationshipStartedOn: client.relationshipStartedOn ?? undefined,
    notes: client.notes ?? undefined,
    maneuverCount:
      typeof (client as Client & { maneuverCount?: number }).maneuverCount ===
      'number'
        ? (client as Client & { maneuverCount?: number }).maneuverCount
        : undefined,
    billing: client.billing
      ? {
          invoiceLegalName: client.billing.invoiceLegalName,
          taxRegime: client.billing.taxRegime,
          fiscalZip: client.billing.fiscalZip,
          cfdiUse: client.billing.cfdiUse,
          billingEmail: client.billing.billingEmail,
          billingPhone: client.billing.billingPhone,
        }
      : undefined,
    paymentTerms: client.paymentTerms
      ? {
          hasCredit: client.paymentTerms.hasCredit,
          creditDays: client.paymentTerms.creditDays,
          approximateCreditAmount: client.paymentTerms.approximateCreditAmount,
          commercialHealth: client.paymentTerms.commercialHealth,
        }
      : undefined,
    contacts: (client.contacts ?? []).map(serializeClientContact),
    createdAt: toIsoString(client.createdAt),
    updatedAt: toIsoString(client.updatedAt),
  };
}

function serializeClientContact(contact: ClientContact): Record<string, unknown> {
  return {
    id: contact.publicId,
    name: contact.name,
    role: contact.role ?? undefined,
    phone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    sortOrder: contact.sortOrder,
  };
}
