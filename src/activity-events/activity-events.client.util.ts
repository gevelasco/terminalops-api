import type { UpdateClientDto } from 'src/clients/dto/update-client.dto';

export const CLIENT_UPDATE_SECTION = {
  ident: 'Identificación comercial',
  fiscal: 'Datos fiscales',
  delivery: 'Datos de entrega',
  contacts: 'Personas de contacto',
  pay: 'Condiciones de cobro',
} as const;

export const CLIENT_UPDATE_TAB_TITLE = 'Detalles';

type ClientUpdateSectionKey = keyof typeof CLIENT_UPDATE_SECTION;

function textOf(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function coordOf(value: unknown): string {
  if (value == null || value === '') {
    return '';
  }
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(6) : '';
}

function identChanged(
  existing: Record<string, unknown>,
  dto: UpdateClientDto,
): boolean {
  if (dto.name !== undefined && textOf(dto.name) !== textOf(existing['name'])) {
    return true;
  }
  if (dto.rfc !== undefined && textOf(dto.rfc) !== textOf(existing['rfc'])) {
    return true;
  }
  if (
    dto.relationshipStartedOn !== undefined &&
    textOf(dto.relationshipStartedOn) !== textOf(existing['relationshipStartedOn'])
  ) {
    return true;
  }
  if (dto.notes !== undefined && textOf(dto.notes) !== textOf(existing['notes'])) {
    return true;
  }
  return false;
}

function billingSnapshot(raw: Record<string, unknown>): string {
  return JSON.stringify({
    invoiceLegalName: textOf(raw['invoiceLegalName']),
    taxRegime: textOf(raw['taxRegime']),
    fiscalZip: textOf(raw['fiscalZip']),
    cfdiUse: textOf(raw['cfdiUse']),
    billingEmail: textOf(raw['billingEmail']),
    billingPhone: textOf(raw['billingPhone']),
  });
}

function fiscalChanged(
  existing: Record<string, unknown>,
  dto: UpdateClientDto,
): boolean {
  if (dto.billing) {
    return billingSnapshot(asRecord(dto.billing)) !== billingSnapshot(asRecord(existing['billing']));
  }
  return false;
}

function deliverySnapshot(raw: Record<string, unknown>): string {
  return JSON.stringify({
    postalCode: textOf(raw['postalCode']),
    cityMunicipality: textOf(raw['cityMunicipality']),
    locality: textOf(raw['locality']),
    settlementConsId: textOf(raw['settlementConsId']),
    latitude: coordOf(raw['latitude']),
    longitude: coordOf(raw['longitude']),
  });
}

function deliveriesSnapshot(list: unknown): string {
  const rows = Array.isArray(list) ? list : [];
  return JSON.stringify(rows.map((row) => deliverySnapshot(asRecord(row))));
}

function deliveriesFromExisting(existing: Record<string, unknown>): unknown[] {
  const list = existing['deliveries'];
  if (Array.isArray(list) && list.length > 0) {
    return list;
  }
  const singular = existing['delivery'];
  if (singular && typeof singular === 'object') {
    return [singular];
  }
  return [];
}

function deliveriesFromDto(dto: UpdateClientDto): unknown[] | undefined {
  if (dto.deliveries !== undefined) {
    return dto.deliveries;
  }
  if (dto.delivery) {
    return [dto.delivery];
  }
  return undefined;
}

function deliveryChanged(
  existing: Record<string, unknown>,
  dto: UpdateClientDto,
): boolean {
  const next = deliveriesFromDto(dto);
  if (next === undefined) {
    return false;
  }
  return deliveriesSnapshot(next) !== deliveriesSnapshot(deliveriesFromExisting(existing));
}

function contactsSnapshot(list: unknown): string {
  const rows = Array.isArray(list) ? list : [];
  return JSON.stringify(
    rows.map((row) => {
      const contact = asRecord(row);
      return {
        name: textOf(contact['name']),
        role: textOf(contact['role']),
        phone: textOf(contact['phone']),
        email: textOf(contact['email']),
      };
    }),
  );
}

function contactsChanged(
  existing: Record<string, unknown>,
  dto: UpdateClientDto,
): boolean {
  if (dto.contacts === undefined) {
    return false;
  }
  return contactsSnapshot(dto.contacts) !== contactsSnapshot(existing['contacts']);
}

function paymentSnapshot(raw: Record<string, unknown>): string {
  const hasCredit = Boolean(raw['hasCredit']);
  return JSON.stringify({
    hasCredit,
    creditDays: hasCredit ? textOf(raw['creditDays']) : '',
    approximateCreditAmount: hasCredit ? textOf(raw['approximateCreditAmount']) : '',
    defaultPaymentMethod: textOf(raw['defaultPaymentMethod']),
  });
}

function paymentChanged(
  existing: Record<string, unknown>,
  dto: UpdateClientDto,
): boolean {
  if (!dto.payment) {
    return false;
  }
  return (
    paymentSnapshot(asRecord(dto.payment)) !==
    paymentSnapshot(asRecord(existing['paymentTerms']))
  );
}

const SECTION_CHECKS: ReadonlyArray<{
  key: ClientUpdateSectionKey;
  changed: (existing: Record<string, unknown>, dto: UpdateClientDto) => boolean;
}> = [
  { key: 'ident', changed: identChanged },
  { key: 'fiscal', changed: fiscalChanged },
  { key: 'delivery', changed: deliveryChanged },
  { key: 'contacts', changed: contactsChanged },
  { key: 'pay', changed: paymentChanged },
];

export function clientUpdateChangedSectionLabels(
  existing: Record<string, unknown>,
  dto: UpdateClientDto,
): string[] {
  return SECTION_CHECKS.filter((section) => section.changed(existing, dto)).map(
    (section) => CLIENT_UPDATE_SECTION[section.key],
  );
}

export function clientPatchActivity(
  existing: Record<string, unknown>,
  dto: UpdateClientDto,
): { title: string } {
  const sections = clientUpdateChangedSectionLabels(existing, dto);
  if (sections.length === 1) {
    return { title: sections[0] };
  }
  return { title: CLIENT_UPDATE_TAB_TITLE };
}
