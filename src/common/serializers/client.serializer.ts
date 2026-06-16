import { Client } from 'src/clients/entities/client.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeClient(client: Client): Record<string, unknown> {
  return {
    id: client.id,
    companyId: client.companyId,
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
          defaultPaymentMethod: client.paymentTerms.defaultPaymentMethod ?? undefined,
        }
      : undefined,
    delivery: client.delivery
      ? serializeClientDelivery(client.delivery)
      : undefined,
    contacts: (client.contacts ?? []).map(serializeClientContact),
    createdAt: toIsoString(client.createdAt),
    updatedAt: toIsoString(client.updatedAt),
  };
}

function serializeClientContact(contact: ClientContact): Record<string, unknown> {
  return {
    id: contact.id,
    name: contact.name,
    role: contact.role ?? undefined,
    phone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    sortOrder: contact.sortOrder,
  };
}

function serializeClientDelivery(delivery: ClientDelivery): Record<string, unknown> {
  const lat = delivery.latitude != null ? Number(delivery.latitude) : undefined;
  const lon = delivery.longitude != null ? Number(delivery.longitude) : undefined;
  return {
    postalCode: delivery.postalCode ?? undefined,
    cityMunicipality: delivery.cityMunicipality ?? undefined,
    locality: delivery.locality ?? undefined,
    settlementConsId: delivery.settlementConsId ?? undefined,
    latitude: lat != null && Number.isFinite(lat) ? lat : undefined,
    longitude: lon != null && Number.isFinite(lon) ? lon : undefined,
    destinationRateId: delivery.destinationRateId ?? undefined,
    isUnpricedRoute: delivery.isUnpricedRoute ?? false,
  };
}
