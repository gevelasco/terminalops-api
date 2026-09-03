import {
  CLIENT_UPDATE_SECTION,
  CLIENT_UPDATE_TAB_TITLE,
  clientPatchActivity,
  clientUpdateChangedSectionLabels,
} from './activity-events.client.util';

const existingClient = {
  name: 'Acme SA',
  rfc: 'ACM010101AAA',
  relationshipStartedOn: '2024-01-15',
  notes: 'Cliente frecuente',
  billing: {
    invoiceLegalName: 'Acme SA de CV',
    taxRegime: '601',
    fiscalZip: '01000',
    cfdiUse: 'G03',
    billingEmail: 'facturas@acme.test',
    billingPhone: '5550000000',
  },
  paymentTerms: {
    hasCredit: true,
    creditDays: 30,
    approximateCreditAmount: '100000',
    defaultPaymentMethod: 'transfer',
  },
  delivery: {
    postalCode: '01000',
    cityMunicipality: 'Álvaro Obregón',
    locality: 'San Ángel',
    settlementConsId: '09010001',
    latitude: 19.3467,
    longitude: -99.1889,
    destinationRateId: 4,
    isUnpricedRoute: false,
  },
  contacts: [
    {
      id: 1,
      name: 'Ana Pérez',
      role: 'Compras',
      phone: '5551112233',
      email: 'ana@acme.test',
      sortOrder: 0,
    },
  ],
};

const matchingPatch = {
  name: 'Acme SA',
  rfc: 'ACM010101AAA',
  relationshipStartedOn: '2024-01-15',
  notes: 'Cliente frecuente',
  billing: {
    invoiceLegalName: 'Acme SA de CV',
    taxRegime: '601',
    fiscalZip: '01000',
    cfdiUse: 'G03',
    billingEmail: 'facturas@acme.test',
    billingPhone: '5550000000',
  },
  payment: {
    hasCredit: true,
    creditDays: 30,
    approximateCreditAmount: '100000',
    defaultPaymentMethod: 'transfer',
  },
  delivery: {
    postalCode: '01000',
    cityMunicipality: 'Álvaro Obregón',
    locality: 'San Ángel',
    settlementConsId: '09010001',
    latitude: 19.3467,
    longitude: -99.1889,
  },
  contacts: [
    {
      name: 'Ana Pérez',
      role: 'Compras',
      phone: '5551112233',
      email: 'ana@acme.test',
    },
  ],
};

describe('clientUpdateChangedSectionLabels', () => {
  it('ignores an unchanged full-body patch', () => {
    expect(clientUpdateChangedSectionLabels(existingClient, matchingPatch)).toEqual([]);
  });

  it('labels identification changes', () => {
    expect(
      clientUpdateChangedSectionLabels(existingClient, {
        ...matchingPatch,
        notes: 'Prioridad alta',
      }),
    ).toEqual([CLIENT_UPDATE_SECTION.ident]);
  });

  it('labels fiscal changes', () => {
    expect(
      clientUpdateChangedSectionLabels(existingClient, {
        ...matchingPatch,
        billing: {
          ...matchingPatch.billing,
          billingEmail: 'nuevo@acme.test',
        },
      }),
    ).toEqual([CLIENT_UPDATE_SECTION.fiscal]);
  });

  it('labels delivery changes and ignores derived route fields', () => {
    expect(
      clientUpdateChangedSectionLabels(existingClient, {
        ...matchingPatch,
        delivery: {
          ...matchingPatch.delivery,
          locality: 'Florida',
        },
      }),
    ).toEqual([CLIENT_UPDATE_SECTION.delivery]);
  });

  it('labels deliveries array changes', () => {
    expect(
      clientUpdateChangedSectionLabels(existingClient, {
        ...matchingPatch,
        deliveries: [
          matchingPatch.delivery,
          {
            postalCode: '64000',
            locality: 'Monterrey Centro',
          },
        ],
      }),
    ).toEqual([CLIENT_UPDATE_SECTION.delivery]);
  });

  it('labels contact changes without using ids or sort order', () => {
    expect(
      clientUpdateChangedSectionLabels(existingClient, {
        ...matchingPatch,
        contacts: [
          {
            name: 'Ana Pérez',
            role: 'Tráfico',
            phone: '5551112233',
            email: 'ana@acme.test',
          },
        ],
      }),
    ).toEqual([CLIENT_UPDATE_SECTION.contacts]);
  });

  it('labels payment-term changes from paymentTerms vs payment', () => {
    expect(
      clientUpdateChangedSectionLabels(existingClient, {
        ...matchingPatch,
        payment: {
          ...matchingPatch.payment,
          creditDays: 45,
        },
      }),
    ).toEqual([CLIENT_UPDATE_SECTION.pay]);
  });
});

describe('clientPatchActivity', () => {
  it('uses the section as the title when only one changed', () => {
    expect(
      clientPatchActivity(existingClient, {
        ...matchingPatch,
        name: 'Acme Industrial',
      }),
    ).toEqual({ title: CLIENT_UPDATE_SECTION.ident });
  });

  it('falls back to the details tab when nothing or several sections changed', () => {
    expect(clientPatchActivity(existingClient, matchingPatch)).toEqual({
      title: CLIENT_UPDATE_TAB_TITLE,
    });
    expect(
      clientPatchActivity(existingClient, {
        ...matchingPatch,
        name: 'Acme Industrial',
        payment: {
          ...matchingPatch.payment,
          hasCredit: false,
        },
      }),
    ).toEqual({ title: CLIENT_UPDATE_TAB_TITLE });
  });
});
